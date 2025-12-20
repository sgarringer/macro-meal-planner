app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});