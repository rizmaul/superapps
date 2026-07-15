This document will explain the algorithm that will be implemented in Spending. 

# Process
Every month, I will put "quota" that dictates how much I could spend in a month. Then that monthly quota will be splitted into daily quota. This daily quota dictates how much money I could spend within a day. 

There will also be a "debt" variable which it will add a new debt if I spend above the daily quota. This "debt" will carried over into the next month. This "debt" will be paid if I have money left in daily quota. 

## Example
Lets say the month is 30 day and I set the monthly quota as 3.000.000 rupiah. That means I could spend 100.000 rupiah per day. If in the first day I spend 150.000 rupiah, I will have 50.000 of debt. And let's say in the next day I didn't spend any money, the debt will be minus by 70.000 that will result in 0 debt. There's no minus debt. This will be carried over to next month

# Technicalities
- I could change the monthly quota whenever I want to
- There's a toggle which expenses that will be using daily quota or not; although the default should be using the daily quota
- Money inputs (amount and monthly quota) are dynamically formatted with dots (.) as thousand separators as the user types


# User Experience
- Only show the spending of this month in the main page by default
- Add month selection
- Add category filter
- Add grouping toggle
- Add date range filter
