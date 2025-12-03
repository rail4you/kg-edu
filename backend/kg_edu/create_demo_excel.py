#!/usr/bin/env python3
"""
Script to create demo.xlsx file for testing Excel import functionality.
"""

try:
    from openpyxl import Workbook
    
    # Create a new workbook
    wb = Workbook()
    ws = wb.active
    
    # Add data according to PRD requirements
    ws.append(["Comment row - this should be ignored"])  # First row (comment)
    ws.append(["name", "age"])  # Header row
    ws.append(["Alice", 25])    # Data row 1
    ws.append(["Bob", 30])      # Data row 2
    ws.append(["Charlie", 35])  # Data row 3
    ws.append(["Diana", 28])    # Data row 4
    
    # Save the file
    wb.save("demo.xlsx")
    print("demo.xlsx created successfully!")
    
except ImportError:
    print("openpyxl not available, creating CSV file instead...")
    
    # Create CSV as fallback
    import csv
    
    data = [
        ["Comment row - this should be ignored"],  # First row (comment)
        ["name", "age"],  # Header row
        ["Alice", 25],    # Data row 1
        ["Bob", 30],      # Data row 2
        ["Charlie", 35],  # Data row 3
        ["Diana", 28]     # Data row 4
    ]
    
    with open('demo.csv', 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        for row in data:
            writer.writerow(row)
    
    print("demo.csv created successfully! (Convert to XLSX for testing)")