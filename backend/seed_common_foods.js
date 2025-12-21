const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./macro_meal_planner.db');

const commonFoods = [
  // Proteins
  { name: 'Chicken Breast', brand: null, serving_size: '100g', calories_per_serving: 165, protein_per_serving: 31, carbs_per_serving: 0, fat_per_serving: 3.6, fiber_per_serving: 0, is_common: 1 },
  { name: 'Salmon', brand: null, serving_size: '100g', calories_per_serving: 208, protein_per_serving: 20, carbs_per_serving: 0, fat_per_serving: 13, fiber_per_serving: 0, is_common: 1 },
  { name: 'Eggs', brand: null, serving_size: '2 large', calories_per_serving: 155, protein_per_serving: 13, carbs_per_serving: 1.1, fat_per_serving: 11, fiber_per_serving: 0, is_common: 1 },
  { name: 'Greek Yogurt', brand: null, serving_size: '1 cup', calories_per_serving: 100, protein_per_serving: 17, carbs_per_serving: 6, fat_per_serving: 0.7, fiber_per_serving: 0, is_common: 1 },
  { name: 'Tuna', brand: null, serving_size: '100g', calories_per_serving: 144, protein_per_serving: 30, carbs_per_serving: 0, fat_per_serving: 1, fiber_per_serving: 0, is_common: 1 },
  
  // Carbs
  { name: 'Brown Rice', brand: null, serving_size: '1 cup cooked', calories_per_serving: 216, protein_per_serving: 5, carbs_per_serving: 45, fat_per_serving: 1.8, fiber_per_serving: 3.5, is_common: 1 },
  { name: 'Quinoa', brand: null, serving_size: '1 cup cooked', calories_per_serving: 222, protein_per_serving: 8, carbs_per_serving: 39, fat_per_serving: 3.6, fiber_per_serving: 5.2, is_common: 1 },
  { name: 'Sweet Potato', brand: null, serving_size: '1 medium', calories_per_serving: 103, protein_per_serving: 2.3, carbs_per_serving: 24, fat_per_serving: 0.1, fiber_per_serving: 3.8, is_common: 1 },
  { name: 'Oatmeal', brand: null, serving_size: '1 cup cooked', calories_per_serving: 158, protein_per_serving: 6, carbs_per_serving: 28, fat_per_serving: 2.5, fiber_per_serving: 4, is_common: 1 },
  { name: 'Whole Wheat Bread', brand: null, serving_size: '2 slices', calories_per_serving: 138, protein_per_serving: 8, carbs_per_serving: 24, fat_per_serving: 2, fiber_per_serving: 3.8, is_common: 1 },
  
  // Fats
  { name: 'Avocado', brand: null, serving_size: '1 whole', calories_per_serving: 322, protein_per_serving: 4, carbs_per_serving: 17, fat_per_serving: 29, fiber_per_serving: 13.5, is_common: 1 },
  { name: 'Almonds', brand: null, serving_size: '1 oz', calories_per_serving: 164, protein_per_serving: 6, carbs_per_serving: 6, fat_per_serving: 14, fiber_per_serving: 3.5, is_common: 1 },
  { name: 'Olive Oil', brand: null, serving_size: '1 tbsp', calories_per_serving: 119, protein_per_serving: 0, carbs_per_serving: 0, fat_per_serving: 14, fiber_per_serving: 0, is_common: 1 },
  { name: 'Peanut Butter', brand: null, serving_size: '2 tbsp', calories_per_serving: 188, protein_per_serving: 8, carbs_per_serving: 6, fat_per_serving: 16, fiber_per_serving: 1.6, is_common: 1 },
  
  // Vegetables
  { name: 'Broccoli', brand: null, serving_size: '1 cup', calories_per_serving: 31, protein_per_serving: 2.6, carbs_per_serving: 6, fat_per_serving: 0.3, fiber_per_serving: 2.4, is_common: 1 },
  { name: 'Spinach', brand: null, serving_size: '1 cup raw', calories_per_serving: 7, protein_per_serving: 0.9, carbs_per_serving: 1.1, fat_per_serving: 0.1, fiber_per_serving: 0.7, is_common: 1 },
  { name: 'Bell Peppers', brand: null, serving_size: '1 medium', calories_per_serving: 31, protein_per_serving: 1.3, carbs_per_serving: 7, fat_per_serving: 0.3, fiber_per_serving: 2.5, is_common: 1 },
  
  // Fruits
  { name: 'Banana', brand: null, serving_size: '1 medium', calories_per_serving: 105, protein_per_serving: 1.3, carbs_per_serving: 27, fat_per_serving: 0.4, fiber_per_serving: 3.1, is_common: 1 },
  { name: 'Apple', brand: null, serving_size: '1 medium', calories_per_serving: 95, protein_per_serving: 0.5, carbs_per_serving: 25, fat_per_serving: 0.3, fiber_per_serving: 4.4, is_common: 1 },
  { name: 'Berries', brand: null, serving_size: '1 cup', calories_per_serving: 84, protein_per_serving: 1, carbs_per_serving: 21, fat_per_serving: 0.5, fiber_per_serving: 8, is_common: 1 },
];

db.serialize(() => {
  console.log('Seeding common foods...');
  
  commonFoods.forEach((food, index) => {
    db.run(
      `INSERT INTO foods (user_id, name, brand, serving_size, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, fiber_per_serving, is_common) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [null, food.name, food.brand, food.serving_size, food.calories_per_serving, food.protein_per_serving, food.carbs_per_serving, food.fat_per_serving, food.fiber_per_serving, food.is_common],
      function(err) {
        if (err) {
          console.error(`Error inserting ${food.name}:`, err);
        } else {
          console.log(`✓ Added ${food.name} (ID: ${this.lastID})`);
        }
        
        if (index === commonFoods.length - 1) {
          console.log('Finished seeding common foods!');
          db.close();
        }
      }
    );
  });
});