require('dotenv').config();

const common = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
  dialectOptions:
    process.env.NODE_ENV === 'production'
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
};

module.exports = {
  development: {
    ...common,
    url: process.env.DATABASE_URL,
  },
  test: {
    ...common,
    url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
  },
  production: {
    ...common,
    url: process.env.DATABASE_URL,
  },
};
