# Puerto Rico Property Map - Project Documentation

This project creates an interactive web-based map for visualizing property locations across Puerto Rico, organized by administrative boundaries (counties, barrios, and subbarrios).

## Project Overview

The application combines geographic data processing with web-based visualization to:

1. Display property locations on an interactive map
2. Show administrative boundary layers (counties, barrios, subbarrios)
3. Provide property clustering analysis based on administrative boundaries
4. Secure access to the map with basic password protection

## Components

### 1. Geographic Data Processing (`geo_location.py`)

This script creates the interactive map by:

- Loading shapefiles for Puerto Rico's administrative boundaries
- Processing property location data from CSV
- Creating a multi-layer Folium map with:
  - Three basemap options (Light, Dark, Satellite)
  - Color-coded boundary layers with distinct line styles
  - Interactive tooltips and popups
  - Property markers with detailed information
  - Search functionality, legend, and info box

The map includes several interactive features:
- Layer toggling for comparing boundaries
- Highlighting on hover/click
- Property details on marker click
- Multiple basemap options
- Minimap for context
- Fullscreen mode

### 2. Geographic Clustering Analysis (`geo_clustering.py`)

This script analyzes property locations and:

- Assigns properties to their respective administrative boundaries
- Implements clustering logic (properties grouped if ≥2 per area)
- Generates a detailed clustering report
- Creates a hierarchical classification path for each property
- Exports results to markdown and CSV

The clustering follows this hierarchy:
- Properties are assigned to subbarrios when possible
- If a subbarrio has <2 properties, they're assigned to the parent barrio
- If a barrio has <2 properties, they're assigned to the parent county

### 3. Web Interface (`index.html` & `map.html`)

The web interface consists of:

- A login page with password protection
- A map display page that loads the generated Folium map
- Simple client-side authentication

## Data Sources

The project uses:

- TIGER/Line shapefiles for Puerto Rico's administrative boundaries
- Property data stored in `geo_data.csv` (293 properties with latitude/longitude coordinates)

## Usage

1. Run `geo_location.py` to generate the interactive map
2. Run `geo_clustering.py` to analyze property distribution
3. Host the HTML files on a web server
4. Access the map through `index.html` (password: "your_secure_password")

## Output Files

- `puerto_rico_properties_map.html`: Interactive web map
- `property_clusters.md`: Markdown report of property clustering
- `property_classifications.csv`: Detailed classification data

## Technical Implementation Details

- The map uses different line styles to distinguish boundary levels:
  - Counties: Dashed red lines
  - Barrios: Dotted orange lines
  - Subbarrios: Solid blue lines
- Properties are displayed as blue home icons
- The clustering algorithm ensures efficient property organization by grouping properties by geographic proximity
- Simple client-side authentication protects the map from unauthorized access

## Recommendations for Enhancement

1. Replace client-side authentication with server-side validation
2. Add filtering capabilities for property attributes
3. Implement database storage instead of CSV files
4. Add user management for different access levels
5. Create export functionality for selected properties

Would you like me to explain any particular aspect of the code in more detail?