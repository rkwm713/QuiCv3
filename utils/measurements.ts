// meters_to_feet_inches utility
export const metersToFeet = (meters: number): number => meters * 3.28084;

export const formatMetersToFeetInches = (meters: number): string => {
  const totalFeet = metersToFeet(meters);
  let feet = Math.floor(totalFeet);
  let inches = Math.round((totalFeet - feet) * 12);

  // Handle rounding that pushes inches to 12
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }

  return `${feet}' ${inches}\"`;
}; 