const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

let dataset1 = [];
let dataset2 = [];
let allSymptoms = [];

// Load datasets and extract all unique symptoms
function loadDatasets() {
  const dataset1Path = path.join(__dirname, '../data/dataset1.csv');
  const dataset2Path = path.join(__dirname, '../data/dataset2.csv');

  // Load dataset1
  fs.createReadStream(dataset1Path)
    .pipe(csv())
    .on('data', (row) => {
      dataset1.push(row);
      if (row.Symptom && !allSymptoms.includes(row.Symptom.trim())) {
        allSymptoms.push(row.Symptom.trim());
      }
    })
    .on('end', () => console.log(`[INFO] Loaded dataset1.csv with ${dataset1.length} rows.`));

  // Load dataset2
  fs.createReadStream(dataset2Path)
    .pipe(csv())
    .on('data', (row) => {
      dataset2.push(row);
      if (row.Symptom && !allSymptoms.includes(row.Symptom.trim())) {
        allSymptoms.push(row.Symptom.trim());
      }
    })
    .on('end', () => console.log(`[INFO] Loaded dataset2.csv with ${dataset2.length} rows.`));
}

// Search a dataset for a query in Symptom or Possible Diseases fields
function searchDataset(dataset, query) {
  const results = [];
  const searchableFields = ["Symptom", "Possible Diseases"];

  for (const row of dataset) {
    for (const field of searchableFields) {
      const value = row[field];
      if (value && value.toLowerCase().includes(query.toLowerCase())) {
        results.push(
          `• Symptom: ${row["Symptom"] || "N/A"} | Disease(s): ${row["Possible Diseases"] || "N/A"} | Severity: ${row["Severity"] || "N/A"}`
        );
        break;
      }
    }
  }

  return results.length > 0 ? results.slice(0, 5).join("\n") : "No relevant info found.";
}

function searchDataset1(query) {
  return searchDataset(dataset1, query);
}

function searchDataset2(query) {
  return searchDataset(dataset2, query);
}

// Return all unique symptoms from both datasets
function getAllSymptoms() {
  return allSymptoms;
}

// Return top N most frequent symptoms from both datasets
function getTopSymptoms(n = 10) {
  const freq = {};
  // Count frequency from both datasets
  for (const row of [...dataset1, ...dataset2]) {
    if (row.Symptom) {
      const s = row.Symptom.trim();
      freq[s] = (freq[s] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([symptom]) => symptom);
}

// Load datasets on module load
loadDatasets();

module.exports = {
  searchDataset1,
  searchDataset2,
  getAllSymptoms,
  getTopSymptoms
};