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

  type Subscription {
        bookAdded: Book!
    }
`

module.exports = typeDefs