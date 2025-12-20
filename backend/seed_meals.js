const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./macro_meal_planner.db');

const sampleMeals = [
  {
    user_id: 1,
    name: 'Breakfast',
    type: 'breakfast',
    time_start: '07:00',
    time_end: '09:00',
    protein_percentage: 30,
    carbs_percentage: 45,
    fat_percentage: 25,
    preferences: 'High protein, moderate carbs'
  },
  {
    user_id: 1,
    name: 'Lunch',
    type: 'lunch',
    time_start: '12:00',
    time_end: '13:30',
    protein_percentage: 35,
    carbs_percentage: 40,
    fat_percentage: 25,
    preferences: 'Balanced meal with vegetables'
  },
  {
    user_id: 1,
    name: 'Dinner',
    type: 'dinner',
    time_start: '18:00',
    time_end: '20:00',
    protein_percentage: 40,
    carbs_percentage: 35,
    fat_percentage: 25,
    preferences: 'Lean protein with complex carbs'
  },
  {
    user_id: 1,
    name: 'Morning Snack',
    type: 'snack',
    time_start: '10:00',
    time_end: '10:30',
    protein_percentage: 20,
    carbs_percentage: 60,
    fat_percentage: 20,
    preferences: 'Light and energizing'
  },
  {
    user_id: 1,
    name: 'Afternoon Snack',
    type: 'snack',
    time_start: '15:30',
    time_end: '16:00',
    protein_percentage: 25,
    carbs_percentage: 50,
    fat_percentage: 25,
    preferences: 'Protein-rich to prevent evening cravings'
  }
];

db.serialize(() => {
  console.log('Seeding sample meals...');
  
  sampleMeals.forEach((meal, index) => {
    db.run(
      `INSERT INTO meals (user_id, name, type, time_start, time_end, protein_percentage, carbs_percentage, fat_percentage, preferences) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [meal.user_id, meal.name, meal.type, meal.time_start, meal.time_end, 
       meal.protein_percentage, meal.carbs_percentage, meal.fat_percentage, meal.preferences],
      function(err) {
        if (err) {
          console.error(`Error inserting ${meal.name}:`, err);
        } else {
          console.log(`✓ Added ${meal.name} (ID: ${this.lastID})`);
        }
        
        if (index === sampleMeals.length - 1) {
          console.log('Finished seeding sample meals!');
          db.close();
        }
      }
    );
  });
});