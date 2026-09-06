export const getAuthHeaders = (user?: any) => {
  let token = sessionStorage.getItem("jwt_access_token");

  if (!token && user) {
    if (user.Metadata?.token) {
      token = user.Metadata.token;
    } else if (user.token) {
      token = user.token;
    } else if (user.authToken && typeof user.authToken === "string") {
      token = user.authToken;
    }

    if (token) {
      sessionStorage.setItem("jwt_access_token", token);
    }
  }

  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  return {
    "Content-Type": "application/json",
  };
};
