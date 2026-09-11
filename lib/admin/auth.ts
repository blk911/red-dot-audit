import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getPrivateResearchEmails } from "@/lib/commerce/config";

export async function getAdminUser(): Promise<ChatGPTUser | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  return getPrivateResearchEmails().includes(user.email.toLowerCase()) ? user : null;
}

export async function isAdminRequest() {
  return Boolean(await getAdminUser());
}
