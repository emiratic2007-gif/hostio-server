// Runs every hour (UTC) on the published site and sends the day-before reminders.
import { sendDueReminders } from "../../lib/reminders.js";

export default async () => {
  try { await sendDueReminders(); } catch (e) { console.log("GREŠKA podsjetnici:", e.message); }
};

export const config = { schedule: "@hourly" };
