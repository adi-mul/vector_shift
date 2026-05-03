import { useState, useEffect } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import axios from "axios";

export const HubSpotIntegration = ({
  user,
  org,
  integrationParams,
  setIntegrationParams,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectClick = async () => {
    try {
      setIsConnecting(true);
      const formData = new FormData();
      formData.append("user_id", user);
      formData.append("org_id", org);
      const response = await axios.post(
        `http://localhost:8000/integrations/hubspot/authorize`,
        formData,
      );

      const newWindow = window.open(
        response.data,
        "HubSpot Authorization",
        "width=600, height=600",
      );
      const pollTimer = window.setInterval(() => {
        if (newWindow?.closed !== false) {
          window.clearInterval(pollTimer);
          handleWindowClosed();
        }
      }, 200);
    } catch (e) {
      setIsConnecting(false);
      alert("Error: " + e.response?.data?.detail);
    }
  };

  const handleWindowClosed = async () => {
    try {
      const formData = new FormData();
      formData.append("user_id", user);
      formData.append("org_id", org);
      const response = await axios.post(
        `http://localhost:8000/integrations/hubspot/credentials`,
        formData,
      );
      if (response.data) {
        setIsConnected(true);
        setIntegrationParams((prev) => ({
          ...prev,
          credentials: response.data,
          type: "HubSpot",
        }));
      }
      setIsConnecting(false);
    } catch (e) {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    setIsConnected(
      integrationParams?.credentials && integrationParams?.type === "HubSpot",
    );
  }, [integrationParams]);

  return (
    <Box sx={{ mt: 2 }} display="flex" justifyContent="center">
      <Button
        variant="contained"
        onClick={isConnected ? null : handleConnectClick}
        color={isConnected ? "success" : "primary"}
        disabled={isConnecting}
      >
        {isConnected ? (
          "HubSpot Connected"
        ) : isConnecting ? (
          <CircularProgress size={20} />
        ) : (
          "Connect to HubSpot"
        )}
      </Button>
    </Box>
  );
};
