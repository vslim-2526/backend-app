import dotenv from "dotenv";
import path from "path";

// Load .env before exporting anything
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const PORT = parseInt(process.env.PORT || "8000", 10);
export const ENV = process.env.ENV || "DEV";
export const MONGODB_ENDPOINT = process.env.MONGODB_ENDPOINT;
export const LLM_PARSE_URL = process.env.LLM_PARSE_URL;
