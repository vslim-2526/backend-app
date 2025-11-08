import express from "express";
import cors from "cors";
import { PORT, ENV } from "../config";

import { ChatController, ExpenseController } from "./app/controller";
import * as Utils from "./app/utils";
import * as Middlewares from "./app/middleware/index";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "*" }));

// app.use(Middlewares.disableCors);

app.post("/v1/chat", async (req, res, next) => {
  const sanInput = Utils.sanitizeString(req.body.utterance || "");
  const sanUserId = Utils.sanitizeString(req.query.user_id || "");
  const result = await new ChatController().handleChat(sanUserId, sanInput);

  res.status(200).json(result);
  next();
});

app.get("/v1/expense/one/:expense_id", async (req, res, next) => {
  const sanInput = Utils.sanitizeString(req.params.expense_id || "");

  const result = await new ExpenseController().getAnExpense(sanInput);
  res.status(200).json(result);
  next();
});

app.get("/v1/expense/many", async (req, res, next) => {
  const sanInput = Utils.sanitizeObject(req.query);

  const criteria: any = Utils.extractCriteriaForSearch(sanInput);
  const result = await new ExpenseController().getExpenses(criteria);

  res.status(200).json({ result });
  next();
});

app.post("/v1/expense", async (req, res, next) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be an array" });
  }
  const sanInputs = req.body.map((expense) => Utils.sanitizeObject(expense));

  const result = await new ExpenseController().createExpenses(sanInputs);
  res.status(200).json(result);
  next();
});

app.put("/v1/expense", async (req, res, next) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be an array" });
  }

  const sanInputs = req.body.map((expense) => Utils.sanitizeObject(expense));

  const result = await new ExpenseController().updateExpenses(sanInputs);
  res.status(200).json(result);
  next();
});

app.delete("/v1/expense", async (req, res, next) => {
  const sanIds = req.body.deleted_ids.map((id: string) =>
    Utils.sanitizeString(id)
  );

  const result = await new ExpenseController().deleteExpenses(sanIds);
  res.status(200).json(result);
  next();
});

app.get("/v1/statistics", async (req, res, next) => {
  const sanInput = Utils.sanitizeObject(req.query);

  const criteria: any = Utils.extractCriteriaForSearch(sanInput);
  const result = await new ExpenseController().getStatistics(criteria);
  res.status(200).json(result);
  next();
});

app.post("/v1/test/date", async (req, res, next) => {
  const result = await Utils.parseDateRange(req.body.text as string);

  res.status(200).json(result);
  next();
});

app.post("/v1/test/price", async (req, res, next) => {
  const result = await Utils.parseVietnameseMoney(req.body.text as string);

  res.status(200).json(result);
  next();
});

app.get("/health", (req, res, next) => {
  res.status(200).json({ status: "OK", message: "Healthy!", version: "1.0.3" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}, env: ${ENV}`);
});
