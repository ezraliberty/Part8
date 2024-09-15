const Book = require("./models/book");
const User = require("./models/user");
const Author = require("./models/author");
const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");
const { PubSub } = require("graphql-subscriptions");
const pubsub = new PubSub();

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      const filter = {};
      if (args.author) {
        const author = await Author.findOne({ name: args.author });
        if (author) {
          filter.author = author._id;
        }
      }
      if (args.genres) {
        filter.genres = { $in: [args.genres] };
      }
      const books = await Book.find(filter).populate("author");
      return books.map((book) => ({
        id: book._id,
        title: book.title,
        published: book.published,
        author: book.author,
        genres: {
          genres: book.genres.length > 0 ? book.genres : [],
        },
      }));
    },
    allGenres: async () => {
      const books = await Book.find();
      const allGenres = [];

      books.forEach((book) => {
        book.genres.forEach((genre) => {
          if (!allGenres.includes(genre)) {
            allGenres.push(genre);
          }
        });
      });

      return { genres: allGenres };
    },
    allAuthors: async () => {
      const authorsWithBookCount = await Author.aggregate([
        {
          $lookup: {
            from: "books",
            localField: "_id",
            foreignField: "author",
            as: "books",
          },
        },
        {
          $project: {
            name: 1,
            born: 1,
            bookCount: { $size: "$books" },
          },
        },
      ]);

      return authorsWithBookCount;
    },
    me: (root, args, context) => {
      return context.currentUser;
    },
  },
  Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      const author = await Author.findOne({ name: args.author });
      if (!author) {
        throw new Error("Author not found");
      }

      if (args.title.length < 5) {
        throw new GraphQLError(
          "Book title must be at least 5 characters long."
        );
      }

      const book = new Book({ ...args, author: author._id });
      try {
        await book.save();
      } catch (error) {
        throw new GraphQLError("Adding New Book Failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.title,
            error,
          },
        });
      }
      const populatedBook = await book.populate("author");

      const returnValue = {
        id: populatedBook.id,
        title: populatedBook.title,
        published: populatedBook.published,
        author: populatedBook.author,
        genres: {
          genres: populatedBook.genres.length > 0 ? populatedBook.genres : [],
        },
      };
      pubsub.publish("BOOK_ADDED", { bookAdded: returnValue });

      return returnValue;
    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser;
      console.log(currentUser);

      if (!currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      const author = await Author.findOne({ name: args.name });
      if (!author) {
        return null;
      }
      author.born = args.born;
      await author.save();
      return author;
    },
    addAuthor: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new GraphQLError("not authenticated", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      if (args.name.length < 4) {
        throw new GraphQLError(
          "Author's Name must be at least 4 characters long."
        );
      }
      const author = new Author({ ...args });
      try {
        await author.save();
      } catch (error) {
        throw new GraphQLError("Adding Author Failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.name,
            error,
          },
        });
      }
    },
    createUser: async (root, args) => {
      const user = new User({
        username: args.username,
        favoriteGenre: args.favoriteGenre,
      });

      return user.save().catch((error) => {
        throw new GraphQLError("Creating the user failed", {
          extensions: {
            code: "BAD_USER_INPUT",
            invalidArgs: args.username,
            error,
          },
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });

      if (!user || args.password !== "secret") {
        throw new GraphQLError("wrong credentials", {
          extensions: {
            code: "BAD_USER_INPUT",
          },
        });
      }

      const userForToken = {
        username: user.username,
        id: user._id,
      };

      return { value: jwt.sign(userForToken, process.env.JWT_SECRET) };
    },
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator("BOOK_ADDED"),
    },
  },
};

module.exports = resolvers;
