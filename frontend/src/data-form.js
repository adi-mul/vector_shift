import { useState } from "react";
import { Box, TextField, Button } from "@mui/material";
import axios from "axios";

const endpointMapping = {
  Notion: "notion",
  Airtable: "airtable",
  HubSpot: "hubspot", // Added hubspot
  Slack: "slack", // Added slack
};

export const DataForm = ({ integrationType, credentials }) => {
  const [loadedData, setLoadedData] = useState(null);
  const endpoint = endpointMapping[integrationType];

  const handleLoad = async () => {
    try {
      const formData = new FormData();

      formData.append("credentials", JSON.stringify(credentials));

      const response = await axios.post(
        `http://localhost:8000/integrations/${endpoint}/load`,
        formData,
      );

      const data =
        typeof response.data === "object"
          ? JSON.stringify(response.data, null, 2)
          : response.data;

      setLoadedData(data);
    } catch (e) {
      alert(
        e?.response?.data?.detail || "An error occurred while loading data.",
      );
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
      width="100%"
    >
      <Box display="flex" flexDirection="column" width="100%">
        <TextField
          label="Loaded Data"
          value={loadedData || ""}
          multiline // Useful for viewing list of items from Part 2
          rows={10}
          sx={{ mt: 2 }}
          InputLabelProps={{ shrink: true }}
          disabled
        />
        <Button
          onClick={handleLoad}
          sx={{ mt: 2 }}
          variant="contained"
          color="primary"
        >
          Load {integrationType} Data
        </Button>
        <Button
          onClick={() => setLoadedData(null)}
          sx={{ mt: 1 }}
          variant="outlined"
          color="secondary"
        >
          Clear Data
        </Button>
      </Box>
    </Box>
  );
};
