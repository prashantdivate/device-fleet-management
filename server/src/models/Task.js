import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
