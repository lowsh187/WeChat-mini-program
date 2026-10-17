import type { CloudSession } from "./cloud-adapter";
import { cloudAdapter, isCloudSession, object } from "./cloud-adapter";
import { sessionStore } from "../store/session";

// Device-only deletion credential; never displayed, logged or committed.
const KEY = "pathai.cloud.link.v1";
interface Link {
  localId: string;
  session: CloudSession | null;
  pending: boolean;
}
export interface CloudRemovalResult {
  removed: boolean;
  message: string;
}
let link: Link | null = null;
let loaded = false;
let warning = "";
function read() {
  if (!loaded) {
    loaded = true;
    try {
      const raw: unknown = wx.getStorageSync(KEY);
      if (raw) {
        if (
          object(raw) &&
          typeof raw.localId === "string" &&
          typeof raw.pending === "boolean" &&
          (raw.session === null || isCloudSession(raw.session))
        )
          link = raw as unknown as Link;
        else warning = "云端凭据记录异常，勿重复创建；请联系团队确认删除。";
      }
    } catch {
      warning = "无法读取云端凭据，请先恢复本地存储后再联调。";
    }
  }
  return link;
}
function save() {
  wx.setStorageSync(KEY, link);
  warning = "";
}
async function removeCloudSession(): Promise<CloudRemovalResult> {
  const current = read();
  if (!current?.session)
    return {
      removed: false,
      message: "没有可用删除凭据。若创建曾超时，请联系 B 查询，不能宣称云端已删除。",
    };
  const response = await cloudAdapter.deleteSession(
    current.session.sessionId,
    current.session.deletionToken,
  );
  if (response.status !== "success" || !response.data.accepted)
    return {
      removed: false,
      message: response.message || "云端未明确确认删除成功，保留凭据供重试。",
    };
  try {
    wx.removeStorageSync(KEY);
    link = null;
    warning = "";
  } catch {
    return {
      removed: false,
      message: "云端已确认删除，但本地凭据清理失败，请联系团队清理残留。",
    };
  }
  return {
    removed: true,
    message: "云端已确认删除成功。你仍可单独清除本地进度。",
  };
}
export const cloudSession = {
  status() {
    const current = read();
    return {
      connected: !!current?.session,
      pending: !!current?.pending,
      warning,
      linked: !!current?.session && current.localId === sessionStore.snapshot().session?.localId,
    };
  },
  current() {
    const current = read();
    return current &&
      current.localId === sessionStore.snapshot().session?.localId &&
      current.session &&
      Date.parse(current.session.expiresAt) > Date.now()
      ? current.session
      : null;
  },
  async connect() {
    read();
    if (warning) return "本地凭据不可用，请联系团队确认云端状态；未创建新会话。";
    if (link?.session) return "已有云端会话。切换本地体验前，请先删除此云端记录。";
    if (link?.pending) return "此前创建结果未确认，已阻止重复创建。请联系 B 查询或恢复会话。";
    const local = sessionStore.snapshot().session;
    if (!local) return "请先开始一次本地体验。";
    link = { localId: local.localId, session: null, pending: true };
    try {
      save();
    } catch {
      link = null;
      return "无法保存删除凭据，未调用云端。请先恢复本地存储。";
    }
    const response = await cloudAdapter.createSession((session) => {
      // Runs even if a timed-out request eventually succeeds; retain deletion credentials.
      link = { localId: local.localId, session, pending: false };
      try {
        save();
      } catch {
        warning = "云端会话已创建，但凭据仅在本次运行中保留；请先重试保存或删除，勿退出。";
      }
    });
    if (response.status === "error") return `${response.message} 创建结果需确认，请勿重复创建。`;
    return (
      warning ||
      (response.status === "degraded"
        ? response.message
        : "云端匿名会话已创建，可以开始真实推荐与试岗流程。")
    );
  },
  retrySave() {
    read();
    if (!link?.session) return "没有可重试保存的已知凭据，未覆盖本地记录；请联系 B 确认云端状态。";
    try {
      save();
      return "云端删除凭据已保存。";
    } catch {
      return "凭据保存失败，请勿退出；可先尝试删除云端记录。";
    }
  },
  removeWithResult() {
    return removeCloudSession();
  },
  async remove() {
    return (await removeCloudSession()).message;
  },
};
