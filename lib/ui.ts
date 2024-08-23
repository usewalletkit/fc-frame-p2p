import { createSystem } from "frog/ui";

export const { Box, Image, Icon, Text, VStack, Spacer, vars } = createSystem({
  colors: {
    bg: "rgb(255,255,255)",
    text_bg: "rgba(250, 250, 250, 0.95)",
    white: "rgb(245,254,255)",
    black: "rgb(32,32,32)",
    grey: "rgba(111, 111, 111, 1)",
    blue: "rgb(68,137,255)",
    green: "rgba(52, 168, 83, 1)",
    process: "rgb(255, 204, 0)", // or rgb(220,209,191)
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
        weight: 500,
      },
      {
        name: "Poppins",
        source: "google",
        weight: 600,
      },
    ],
  },
});
