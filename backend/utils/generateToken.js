import jwt from "jsonwebtoken";

// Internal helpers with sane defaults and validation
const getAccessTokenConfig = () => {
  const secret = process.env.JWT_ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_TOKEN_SECRET is not defined");
  }

  const days = Number(process.env.JWT_ACCESS_TOKEN_EXPIRY);
  const expiresInDays = Number.isFinite(days) && days > 0 ? days : 1; // default 1 day

  return { secret, expiresIn: `${expiresInDays}d` };
};

const getRefreshTokenConfig = () => {
  const secret = process.env.JWT_REFRESH_TOKEN_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_TOKEN_SECRET is not defined");
  }

  const days = Number(process.env.JWT_REFRESH_TOKEN_EXPIRY);
  const expiresInDays = Number.isFinite(days) && days > 0 ? days : 7; // default 7 days

  return { secret, expiresIn: `${expiresInDays}d` };
};

// Generate JWT Access Token
export const generateAccessToken = (userId) => {
  const { secret, expiresIn } = getAccessTokenConfig();
  return jwt.sign({ userId }, secret, { expiresIn });
};

// Generate JWT Refresh Token
export const generateRefreshToken = (userId) => {
  const { secret, expiresIn } = getRefreshTokenConfig();
  return jwt.sign({ userId }, secret, { expiresIn });
};

// Generate both Access and Refresh Tokens
export const generateTokens = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  return { accessToken, refreshToken };
};

// Verify JWT Access Token
export const verifyAccessToken = (token) => {
  const { secret } = getAccessTokenConfig();
  return jwt.verify(token, secret);
};

// Verify JWT Refresh Token
export const verifyRefreshToken = (token) => {
  const { secret } = getRefreshTokenConfig();
  return jwt.verify(token, secret);
};