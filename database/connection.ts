import 'dotenv/config';

export interface CloudSqlMySqlConfig {
  dialect: 'mysql';
  instance: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  connectionString: string;
}

export function getCloudSqlConfig(): CloudSqlMySqlConfig {
  const host = process.env.DB_HOST || '35.231.76.131';
  const port = Number(process.env.DB_PORT || 3306);
  const instance = process.env.DB_INSTANCE || 'super-opsys';
  const database = process.env.DB_NAME || 'super_opsys';
  const user = process.env.DB_USER || '';
  const password = process.env.DB_PASSWORD || '';
  const ssl = (process.env.DB_SSL || 'true').toLowerCase() === 'true';

  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);
  const connectionString =
    process.env.DATABASE_URL ||
    `mysql://${encodedUser}:${encodedPass}@${host}:${port}/${database}`;

  return {
    dialect: 'mysql',
    instance,
    host,
    port,
    database,
    user,
    password,
    ssl,
    connectionString,
  };
}
