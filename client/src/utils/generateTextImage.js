export const generateTextImage = (text) => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 350;

  const ctx = canvas.getContext("2d");

  // Background color
  ctx.fillStyle = "#78afe3ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Text
  ctx.font = "bold 40px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL("image/png");
};
