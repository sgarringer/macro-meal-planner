// CSV Export endpoints for meal plans and foods

app.get('/api/export/meal-plans/csv', authenticateToken, (req, res) => {
  const { start_date, end_date } = req.query;
  
  let query = `
    SELECT mp.date, m.name as meal_name, m.time_start, m.time_end,
           COALESCE(f.name, mp.food_name) as food_name,
           COALESCE(f.serving_size, '1 serving') as serving_size,
           mp.quantity,
           COALESCE(f.calories_per_serving, 0) * mp.quantity as calories,
           COALESCE(f.protein_per_serving, 0) * mp.quantity as protein,
           COALESCE(f.carbs_per_serving, 0) * mp.quantity as carbs,
           COALESCE(f.fat_per_serving, 0) * mp.quantity as fat
    FROM meal_plans mp
    JOIN meals m ON mp.meal_id = m.id
    LEFT JOIN foods f ON mp.food_id = f.id
    WHERE mp.user_id = ?
  `;
  
  let params = [req.user.userId];
  
  if (start_date) {
    query += ' AND mp.date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    query += ' AND mp.date <= ?';
    params.push(end_date);
  }
  
  query += ' ORDER BY mp.date, m.time_start';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Generate CSV
    const csvHeaders = ['Date', 'Meal', 'Time', 'Food Name', 'Serving Size', 'Quantity', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)'];
    const csvRows = rows.map(row => [
      row.date,
      row.meal_name,
      `${row.time_start}-${row.time_end}`,
      row.food_name,
      row.serving_size,
      row.quantity,
      row.calories,
      row.protein,
      row.carbs,
      row.fat
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="meal-plans-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  });
});

app.get('/api/export/foods/csv', authenticateToken, (req, res) => {
  const query = `
    SELECT name, brand, serving_size, calories_per_serving, protein_per_serving,
           carbs_per_serving, fat_per_serving, active,
           CASE WHEN is_common = 1 THEN 'Common' ELSE 'Custom' END as type,
           created_at
    FROM foods 
    WHERE user_id = ? OR user_id IS NULL
    ORDER BY is_common, name
  `;
  
  db.all(query, [req.user.userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Generate CSV
    const csvHeaders = ['Food Name', 'Brand', 'Serving Size', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Active', 'Type', 'Created Date'];
    const csvRows = rows.map(row => [
      row.name,
      row.brand || '',
      row.serving_size,
      row.calories_per_serving,
      row.protein_per_serving,
      row.carbs_per_serving,
      row.fat_per_serving,
      row.active ? 'Yes' : 'No',
      row.type,
      row.created_at
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="foods-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  });
});