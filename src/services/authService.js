/**
 * Authentication Service (V2 Preparation Stub)
 * Clean modular interface ready for Cloudflare Workers / Supabase / OAuth integration in Version 2.
 */
export const authService = {
  /**
   * Get current authenticated user session (returns null in V1)
   */
  getCurrentUser() {
    return null;
  },

  /**
   * Check if user is logged in
   */
  isAuthenticated() {
    return false;
  },

  /**
   * V2 Login Handler Stub
   */
  async login(email, password) {
    console.log("Auth V2 feature stub triggered");
    return { success: false, message: "Authentication will be enabled in Version 2." };
  },

  /**
   * V2 Logout Handler Stub
   */
  async logout() {
    return { success: true };
  }
};
