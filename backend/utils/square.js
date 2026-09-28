import { SquareClient, SquareEnvironment } from "square";

let squareInstance = null;

export const getSquare = () => {
  if (!squareInstance) {
    squareInstance = new SquareClient({
      token: process.env.SQUARE_ACCESS_TOKEN,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
  }
  return squareInstance;
};
