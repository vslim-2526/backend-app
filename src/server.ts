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

app.use("/v1/chat", (req, res, next) => {
  const sanInput = Utils.sanitizeString(req.body.utterance || "");
  const chatController = new ChatController();
  next();
});

app.get("/v1/expense/one/:expense_id", async (req, res, next) => {
  const sanInput = Utils.sanitizeString(req.params.expense_id || "");

  const result = await new ExpenseController().getAnExpense(sanInput);
  res.status(200).json(result);
  next();
});

app.get("/v1/expense/many", async (req, res, next) => {
  const criteria: any = Utils.extractCriteriaForSearch(req.query);
  const result = await new ExpenseController().getExpenses(criteria);

  res.status(200).json({ result });
  next();
});

app.post("/v1/expense/one", async (req, res, next) => {
  const sanInput = Object.fromEntries(
    Object.entries(req.body).map(([k, v]) => [
      k,
      Utils.sanitizeString(v as string),
    ])
  );

  const result = await new ExpenseController().createAnExpense(sanInput);
  res.status(200).json(result);
  next();
});

app.post("/v1/expense/many", async (req, res, next) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be an array" });
  }
  const sanInputs = req.body.map((expense) =>
    Object.fromEntries(
      Object.entries(expense).map(([k, v]) => [
        k,
        Utils.sanitizeString(v as string),
      ])
    )
  );

  const result = await new ExpenseController().createExpenses(sanInputs);
  res.status(200).json(result);
  next();
});

app.get("/health", (req, res, next) => {
  res.status(200).json({ status: "OK", message: "Healthy!" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}, env: ${ENV}`);
});
