import { useState, useEffect } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import axios from "axios";

export const SlackIntegration = ({
  user,
  org,
  integrationParams,
  setIntegrationParams,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Function to open Slack OAuth in a new window
  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      const formData = new FormData();
      formData.append("user_id", user);
      formData.append("org_id", org);

      //  Request the Slack Authorization URL from the backend
      const response = await axios.post(
        `http://localhost:8000/integrations/slack/authorize`,
        formData,
      );
      const authURL = response?.data;

      //  Open the Slack Auth page in a popup
      const newWindow = window.open(
        authURL,
        "Slack Authorization",
        "width=600, height=700",
      );

      //  Polling for the window to close
      const pollTimer = window.setInterval(() => {
        if (newWindow?.closed !== false) {
          window.clearInterval(pollTimer);
          handleWindowClosed();
        }
      }, 200);
    } catch (e) {
      setIsConnecting(false);
      alert(
        e?.response?.data?.detail || "Could not initiate Slack connection.",
      );
    }
  };

  // Function to fetch credentials once the OAuth popup is closed
  const handleWindowClosed = async () => {
    try {
      const formData = new FormData();
      formData.append("user_id", user);
      formData.append("org_id", org);

      const response = await axios.post(
        `http://localhost:8000/integrations/slack/credentials`,
        formData,
      );
      const credentials = response.data;

      if (credentials) {
        setIsConnecting(false);
        setIsConnected(true);
        setIntegrationParams((prev) => ({
          ...prev,
          credentials: credentials,
          type: "Slack",
        }));
      }
      setIsConnecting(false);
    } catch (e) {
      setIsConnecting(false);
      alert(
        e?.response?.data?.detail || "Failed to retrieve Slack credentials.",
      );
    }
  };

  // Sync local state if credentials already exist in parent state
  useEffect(() => {
    setIsConnected(
      integrationParams?.credentials && integrationParams?.type === "Slack",
    );
  }, [integrationParams]);

  return (
    <Box sx={{ mt: 2 }} display="flex" justifyContent="center">
      <Button
        variant="contained"
        onClick={isConnected ? null : handleConnectClick}
        color={isConnected ? "success" : "primary"}
        disabled={isConnecting}
        sx={{
          backgroundColor: isConnected ? "" : "#4A154B",
          "&:hover": {
            backgroundColor: isConnected ? "" : "#350d39",
          },
        }}
      >
        {isConnected ? (
          "Slack Connected"
        ) : isConnecting ? (
          <CircularProgress size={20} />
        ) : (
          "Connect to Slack"
        )}
      </Button>
    </Box>
  );
};
