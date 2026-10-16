import type { RolePreview } from "../models/frontend";
import { backendContent } from "../config/backend-content";
const localIds: Record<string, string> = {
  data_analyst: "ui-data",
  product_operations: "ui-operations",
  user_researcher: "ui-research",
  product_manager: "ui-product",
  project_manager: "ui-project",
  content_strategist: "ui-content",
};
export const roles: RolePreview[] = backendContent.roles.map((role) => {
  const localId = localIds[role.roleId];
  if (!localId) throw new Error("Unknown backend role");
  return { localId, name: role.name, introduction: role.description };
});
