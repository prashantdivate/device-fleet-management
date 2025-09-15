import express from "express";
import Task from "../models/Task.js";
import auth from "../middleware/auth.js";

const router = express.Router();
router.use(auth);

// Create
router.post("/", async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "content is required" });
    }
    const task = await Task.create({ content: content.trim(), user: req.userId });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// Read all for user
router.get("/", async (req, res, next) => {
  try {
    const tasks = await Task.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// Update
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, completed } = req.body;
    const update = {};
    if (typeof content !== "undefined") update.content = content;
    if (typeof completed !== "undefined") update.completed = completed;
    const task = await Task.findOneAndUpdate({ _id: id, user: req.userId }, update, {
      new: true
    });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Delete
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await Task.findOneAndDelete({ _id: id, user: req.userId });
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
