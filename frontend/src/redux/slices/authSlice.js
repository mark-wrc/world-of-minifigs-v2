import { createSlice } from "@reduxjs/toolkit";

// Load user from localStorage on initial state
const loadUserFromStorage = () => {
  try {
    const storedUser = localStorage.getItem("auth_user");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return {
        user,
        isAuthenticated: !!user,
        isLoading: true, // Still loading to verify with API
      };
    }
  } catch (error) {
    console.error("Error loading user from localStorage:", error);
    localStorage.removeItem("auth_user");
  }
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
  };
};

const initialState = loadUserFromStorage();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.isLoading = false;
      // Persist to localStorage
      if (action.payload) {
        try {
          localStorage.setItem("auth_user", JSON.stringify(action.payload));
        } catch (error) {
          console.error("Error saving user to localStorage:", error);
        }
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      // Remove from localStorage
      try {
        localStorage.removeItem("auth_user");
      } catch (error) {
        console.error("Error removing user from localStorage:", error);
      }
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setCredentials, clearCredentials, setLoading } = authSlice.actions;

export default authSlice.reducer;

