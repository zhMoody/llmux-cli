import { settingsService } from "../../services/settings.js";

export function getSettings() {
  try {
    const data = settingsService.getAll();
    return Response.json(data);
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function updateSettings(req: Request) {
  try {
    const body = await req.json();
    settingsService.batchSet(body);
    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
