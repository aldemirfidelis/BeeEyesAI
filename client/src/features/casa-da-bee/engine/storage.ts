// Shim de SecureStore (expo-secure-store) usando localStorage.
// Mesma API async pra permitir copiar os engines do mobile sem mudanca de logica.

const PREFIX = "bee-house:";

export const SecureStore = {
  async getItemAsync(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* quota / safari privado */
    }
  },
  async deleteItemAsync(key: string): Promise<void> {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};
