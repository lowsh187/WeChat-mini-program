export interface StorageAdapter {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
  remove(key: string): void;
}

export const localStorage: StorageAdapter = {
  read: (key) => wx.getStorageSync(key) as unknown,
  write: (key, value) => wx.setStorageSync(key, value),
  remove: (key) => wx.removeStorageSync(key),
};
