import { createSystem } from "frog/ui";

export const { Box, Columns, Column, Divider, Image, Heading, Text, VStack, Spacer, vars } = createSystem({
  colors: {
    bg: "rgb(255,255,255)",
    black: "rgb(32,32,32)",
    grey: "rgb(131,131,131)",
  },
  fonts: {
    default: [
      {
        name: "Poppins",
        source: "google",
        weight: 400,
      },
      {
        name: "Poppins",
        source: "google",
        weight: 600,
      },
    ],
  },
});