import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

# Load data
subbarrio_gdf = gpd.read_file(subbarrio_path).to_crs(epsg=4326)
cousub_gdf = gpd.read_file(cousub_path).to_crs(epsg=4326)
county_gdf = county_gdf[county_gdf['STATEFP'] == '72'].to_crs(epsg=4326)

# Create properties GeoDataFrame
valid_coords = geo_data.dropna(subset=['crim.latitude', 'crim.longitude'])
geometry = [Point(lon, lat) for lon, lat in zip(valid_coords['crim.longitude'], valid_coords['crim.latitude'])]
properties_gdf = gpd.GeoDataFrame(valid_coords, geometry=geometry, crs="EPSG:4326").reset_index(drop=True)

# First assign all properties to their initial level (subbarrio, barrio, county)
# Initial assignment to subbarrios
initial_subbarrio = gpd.sjoin(
   properties_gdf, 
   subbarrio_gdf[['NAMELSAD', 'geometry']], 
   how='left', 
   predicate='within'
).rename(columns={'NAMELSAD': 'initial_subbarrio'}).drop(columns=['index_right'], errors='ignore')

# Initial assignment to barrios
initial_barrio = gpd.sjoin(
   initial_subbarrio,
   cousub_gdf[['NAMELSAD', 'geometry']], 
   how='left', 
   predicate='within'
).rename(columns={'NAMELSAD': 'initial_barrio'}).drop(columns=['index_right'], errors='ignore')

# Initial assignment to counties
initial_county = gpd.sjoin(
   initial_barrio,
   county_gdf[['NAME', 'geometry']], 
   how='left', 
   predicate='within'
).rename(columns={'NAME': 'initial_county'}).drop(columns=['index_right'], errors='ignore')

# Now count properties in each level and reassign those with fewer than 2 properties
# Count subbarrios
subbarrio_counts = initial_county['initial_subbarrio'].value_counts()
valid_subbarrios = subbarrio_counts[subbarrio_counts >= 2].index.tolist()

# Count barrios
barrio_counts = initial_county['initial_barrio'].value_counts()
valid_barrios = barrio_counts[barrio_counts >= 2].index.tolist()

# Make final assignments
initial_county['final_level'] = 'unassigned'
initial_county['final_area'] = None

# Assign to subbarrios if valid
mask_valid_subbarrio = initial_county['initial_subbarrio'].isin(valid_subbarrios)
initial_county.loc[mask_valid_subbarrio, 'final_level'] = 'subbarrio'
initial_county.loc[mask_valid_subbarrio, 'final_area'] = initial_county.loc[mask_valid_subbarrio, 'initial_subbarrio']

# Assign to barrios if not in valid subbarrio but in valid barrio
mask_valid_barrio = (~mask_valid_subbarrio) & initial_county['initial_barrio'].isin(valid_barrios)
initial_county.loc[mask_valid_barrio, 'final_level'] = 'barrio'
initial_county.loc[mask_valid_barrio, 'final_area'] = initial_county.loc[mask_valid_barrio, 'initial_barrio']

# Assign to counties if not in valid subbarrio or valid barrio but has county
mask_county = (~mask_valid_subbarrio) & (~mask_valid_barrio) & initial_county['initial_county'].notna()
initial_county.loc[mask_county, 'final_level'] = 'county'
initial_county.loc[mask_county, 'final_area'] = initial_county.loc[mask_county, 'initial_county']

# Create hierarchical classification column
def create_classification_path(row):
   path_parts = []
   if pd.notna(row['initial_subbarrio']):
       path_parts.append(f"Subbarrio: {row['initial_subbarrio']}")
   if pd.notna(row['initial_barrio']):
       path_parts.append(f"Barrio: {row['initial_barrio']}")
   if pd.notna(row['initial_county']):
       path_parts.append(f"County: {row['initial_county']}")
   return " > ".join(path_parts)

# Add classification path column and prefix with control number
final_properties = initial_county.copy()
final_properties['classification_path'] = final_properties.apply(create_classification_path, axis=1)
final_properties['control_with_path'] = final_properties['Número Control'] + " | " + final_properties['classification_path']

# Group properties by final assignment
subbarrio_groups = final_properties[final_properties['final_level'] == 'subbarrio'].groupby('final_area')
barrio_groups = final_properties[final_properties['final_level'] == 'barrio'].groupby('final_area')
county_groups = final_properties[final_properties['final_level'] == 'county'].groupby('final_area')
unclassified = final_properties[final_properties['final_level'] == 'unassigned']

# Generate report
report = []
report.append("# Properties Clustered by Geographic Boundaries\n")
report.append("(Minimum 2 properties per subbarrio/barrio, otherwise moved to higher level)\n\n")

report.append("## Properties in Subbarrios\n")
for subbarrio, group in subbarrio_groups:
   report.append(f"### {subbarrio} ({len(group)} properties)\n")
   for idx, row in group.iterrows():
       report.append(f"- {row['control_with_path']}\n")
       report.append(f"  Address: {row['Dirección Física'] if not pd.isna(row['Dirección Física']) else 'No address'}\n")

report.append("## Properties in Barrios (not in any Subbarrio or in Subbarrios with <2 properties)\n")
for barrio, group in barrio_groups:
   report.append(f"### {barrio} ({len(group)} properties)\n")
   for idx, row in group.iterrows():
       report.append(f"- {row['control_with_path']}\n")
       report.append(f"  Address: {row['Dirección Física'] if not pd.isna(row['Dirección Física']) else 'No address'}\n")

report.append("## Properties in Counties (not in any valid Barrio or Subbarrio)\n")
for county, group in county_groups:
   report.append(f"### {county} ({len(group)} properties)\n")
   for idx, row in group.iterrows():
       report.append(f"- {row['control_with_path']}\n")
       report.append(f"  Address: {row['Dirección Física'] if not pd.isna(row['Dirección Física']) else 'No address'}\n")

if not unclassified.empty:
   report.append("## Unclassified Properties\n")
   for idx, row in unclassified.iterrows():
       report.append(f"- {row['control_with_path']}\n")
       report.append(f"  Address: {row['Dirección Física'] if not pd.isna(row['Dirección Física']) else 'No address'}\n")

# Write report to file
with open('property_clusters.md', 'w', encoding='utf-8') as f:
   f.write(''.join(report))

# Create a CSV export with all the classification data
final_properties[['Número Control', 'Dirección Física', 'Catastro', 'initial_subbarrio', 
                'initial_barrio', 'initial_county', 'final_level', 'final_area', 
                'classification_path', 'crim.latitude', 'crim.longitude']].to_csv(
   'property_classifications.csv', index=False, encoding='utf-8')

print(f"Total properties analyzed: {len(final_properties)}")
print(f"- In subbarrios: {sum(len(group) for _, group in subbarrio_groups)}")
print(f"- In barrios only: {sum(len(group) for _, group in barrio_groups)}")
print(f"- In counties only: {sum(len(group) for _, group in county_groups)}")
print(f"- Unclassified: {len(unclassified)}")
print("Report saved to property_clusters.md")
print("Classification data saved to property_classifications.csv")