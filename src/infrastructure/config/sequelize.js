import { Sequelize } from 'sequelize';
import { env } from './env.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  // eslint-disable-next-line no-console
  logging: env.NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
  dialectOptions:
    env.NODE_ENV === 'production' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

export async function testConnection() {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('Sequelize connection to application DB established.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to connect to the application database:', error.message);
    throw error;
  }
}
