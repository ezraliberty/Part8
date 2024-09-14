const { ApolloServer } = require("@apollo/server");
const { startStandaloneServer } = require("@apollo/server/standalone");
const { v1: uuid } = require("uuid");
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
const Book = require("./models/book");
const User = require("./models/user");
const Author = require("./models/author");
const { GraphQLError } = require("graphql");
const jwt = require("jsonwebtoken");

require("dotenv").config();

const MONGODB_URI = process.env.DATABASE;

console.log("connecting to", MONGODB_URI);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.log("error connecting to mongoDB:", error.message);
  });

let authors = [
  {
    name: "Robert Martin",
    id: "afa51ab0-344d-11e9-a414-719c6709cf3e",
    born: 1952,
  },
  {
    name: "Martin Fowler",
    id: "afa5b6f0-344d-11e9-a414-719c6709cf3e",
    born: 1963,
  },
  {
    name: "Fyodor Dostoevsky",
    id: "afa5b6f1-344d-11e9-a414-719c6709cf3e",
    born: 1821,
  },
  {
    name: "Joshua Kerievsky", // birthyear not known
    id: "afa5b6f2-344d-11e9-a414-719c6709cf3e",
  },
  {
    name: "Sandi Metz", // birthyear not known
    id: "afa5b6f3-344d-11e9-a414-719c6709cf3e",
  },
];

/*
 * Suomi:
 * Saattaisi olla järkevämpää assosioida kirja ja sen tekijä tallettamalla kirjan yhteyteen tekijän nimen sijaan tekijän id
 * Yksinkertaisuuden vuoksi tallennamme kuitenkin kirjan yhteyteen tekijän nimen
 *
 * English:
 * It might make more sense to associate a book with its author by storing the author's id in the context of the book instead of the author's name
 * However, for simplicity, we will store the author's name in connection with the book
 *
 * Spanish:
 * Podría tener más sentido asociar un libro con su autor almacenando la id del autor en el contexto del libro en lugar del nombre del autor
 * Sin embargo, por simplicidad, almacenaremos el nombre del autor en conexión con el libro
 */

let books = [
  {
    title: "Clean Code",
    published: 2008,
    author: "Robert Martin",
    id: "afa5b6f4-344d-11e9-a414-719c6709cf3e",
    genres: ["refactoring"],
  },
  {
    title: "Agile software development",
    published: 2002,
    author: "Robert Martin",
    id: "afa5b6f5-344d-11e9-a414-719c6709cf3e",
    genres: ["agile", "patterns", "design"],
  },
  {
    title: "Refactoring, edition 2",
    published: 2018,
    author: "Martin Fowler",
    id: "afa5de00-344d-11e9-a414-719c6709cf3e",
    genres: ["refactoring"],
  },
  {
    title: "Refactoring to patterns",
    published: 2008,
    author: "Joshua Kerievsky",
    id: "afa5de01-344d-11e9-a414-719c6709cf3e",
    genres: ["refactoring", "patterns"],
  },
  {
    title: "Practical Object-Oriented Design, An Agile Primer Using Ruby",
    published: 2012,
    author: "Sandi Metz",
    id: "afa5de02-344d-11e9-a414-719c6709cf3e",
    genres: ["refactoring", "design"],
  },
  {
    title: "Crime and punishment",
    published: 1866,
    author: "Fyodor Dostoevsky",
    id: "afa5de03-344d-11e9-a414-719c6709cf3e",
    genres: ["classic", "crime"],
  },
  {
    title: "Demons",
    published: 1872,
    author: "Fyodor Dostoevsky",
    id: "afa5de04-344d-11e9-a414-719c6709cf3e",
    genres: ["classic", "revolution"],
  },
];

/*
  you can remove the placeholder query once your first one has been implemented 
*/

const typeDefs = `
  type Author {
    name: String!
    born: Int
    id: ID!
  }

  type Genres {
    genres: [String!]!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    genres: Genres!
    id: ID!
  }

  type AuthorCount {
    name: String!
    bookCount: Int!
    born: Int
  }

  type User {
    username: String!
    favoriteGenre: String!
    id: ID!
  }

  type Token {
    value: String!
  }

  type Mutation {
    addBook(
      title: String!
      published: Int!
      author: String!
      genres: [String!]!
    ) : Book!
    editAuthor (
      name: String!
      born: Int!
     ) : Author
    addAuthor(
      name: String!
      born: Int
    ) : Author!
    createUser(
      username: String!
      favoriteGenre: String!
    ) : User
    login(
      username: String!
      password: String!
    ) : Token
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genres: String): [Book!]!
    allAuthors: [AuthorCount!]!
    me: User
    allGenres: Genres! 
  }
`;

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
        ...book.toObject(), // Convert Mongoose document to plain object
        genres: {
          genres: book.genres.length > 0 ? book.genres : [], // Ensure genres is not null
        },
      }));
    },
    allGenres: async () => {
      const books = await Book.find(); // Fetch all books
      const allGenres = []; // Initialize an empty array to hold unique genres

      // Loop through each book and its genres
      books.forEach((book) => {
        book.genres.forEach((genre) => {
          // Only add the genre if it's not already in the allGenres array
          if (!allGenres.includes(genre)) {
            allGenres.push(genre);
          }
        });
      });

      return { genres: allGenres }; // Return as Genres type
    },
    // {
    // if (!args.author && !args.genres) {
    //   return Book.find({});
    // }

    // if (args.author)
    // {
    //   const author = await Author.findOne({name: args.author})
    // }
    // return books.filter(book => {
    //   const author = book.author.name === args.author;
    //   const genre = book.genres.includes(args.genres)
    //   return (author && genre) || author || genre
    // })},
    allAuthors: async () => {
      const authors = await Author.find({});
      return authors.map((author) => ({
        name: author.name,
        // bookCount,
        born: author.born,
      }));
    },
    //   authors.map(author => {
    //   const bookCount = books.filter(book => book.author === author.name).length
    //   return {
    //     name: author.name,
    //     bookCount,
    //     born: author.born,
    //   }
    // })
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
            invalidArgs: args.name,
            error,
          },
        });
      }
      const populatedBook = await book.populate("author")

      return {
        id: populatedBook.id,
        title: populatedBook.title,
        published: populatedBook.published,
        author: populatedBook.author,
        genres: { genres: populatedBook.genres }, // Wrap genres in a Genres object
      };
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
      // const updateBorn = {...author, born: args.born}
      // authors = authors.map(a => a.name === args.name ? updateBorn : a)
      // return updateBorn
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
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

startStandaloneServer(server, {
  listen: { port: 4000 },
  context: async ({ req, res }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.startsWith("Bearer ")) {
      const decodedToken = jwt.verify(
        auth.substring(7),
        process.env.JWT_SECRET
      );
      const currentUser = await User.findById(decodedToken.id);
      return { currentUser };
    }
  },
}).then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
