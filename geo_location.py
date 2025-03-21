import geopandas as gpd
import folium
from folium.features import GeoJsonTooltip
from folium.plugins import MiniMap, Search, Fullscreen, MarkerCluster
import base64
from io import BytesIO
from PIL import Image, ImageDraw
import pandas as pd

# Load shapefiles
subbarrio_path = r'C:\Users\arroy\OneDrive\Data Projects\subbarrios_tiger\tl_2024_72_subbarrio\tl_2024_72_subbarrio.shp'
cousub_path = r'C:\Users\arroy\OneDrive\Data Projects\subbarrios_tiger\tl_2024_72_cousub\tl_2024_72_cousub.shp'
county_path = r'C:\Users\arroy\OneDrive\Data Projects\subbarrios_tiger\tl_2024_us_county\tl_2024_us_county.shp'

# Read shapefiles
subbarrio_gdf = gpd.read_file(subbarrio_path)
cousub_gdf = gpd.read_file(cousub_path)
county_gdf = gpd.read_file(county_path)

# Filter counties to Puerto Rico only
pr_county_gdf = county_gdf[county_gdf['STATEFP'] == '72']

# Convert to WGS84
subbarrio_gdf = subbarrio_gdf.to_crs(epsg=4326)
cousub_gdf = cousub_gdf.to_crs(epsg=4326)
pr_county_gdf = pr_county_gdf.to_crs(epsg=4326)

# Load property data from CSV
geo_data = pd.read_csv('geo_data.csv', encoding='utf-8')

# Create map with multiple basemap options
m = folium.Map(location=[18.2208, -66.5901], zoom_start=9, 
               tiles='CartoDB positron', control_scale=True)

# Add basemap options
folium.TileLayer('CartoDB dark_matter', name='Dark Map').add_to(m)
folium.TileLayer('OpenStreetMap', name='OpenStreetMap').add_to(m)
folium.TileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 
                attr='Esri', name='Satellite').add_to(m)

# Add mini-map
MiniMap(toggle_display=True, position='bottomright').add_to(m)

# Add fullscreen button
Fullscreen().add_to(m)

# Create tooltips
county_tooltip = GeoJsonTooltip(fields=['NAME'], aliases=['County:'], sticky=False)
cousub_tooltip = GeoJsonTooltip(fields=['NAMELSAD'], aliases=['Barrio:'], sticky=False)
subbarrio_tooltip = GeoJsonTooltip(fields=['NAMELSAD'], aliases=['Subbarrio:'], sticky=False)

# Define highlight functions
def county_highlight(feature): return {'color': 'white', 'weight': 4, 'fillOpacity': 0.7}
def cousub_highlight(feature): return {'color': 'white', 'weight': 3, 'fillOpacity': 0.7}
def subbarrio_highlight(feature): return {'color': 'white', 'weight': 2, 'fillOpacity': 0.7}

# Add County layer with dashed lines
county_layer = folium.GeoJson(
    data=pr_county_gdf,
    name='Counties (Municipios)',
    style_function=lambda x: {
        'fillColor': '#d73027',
        'color': '#800000',
        'weight': 3,
        'fillOpacity': 0.2,
        'dashArray': '5, 5'  # Dashed line
    },
    highlight_function=county_highlight,
    tooltip=county_tooltip
).add_to(m)

# Add Barrios layer with dotted lines
cousub_layer = folium.GeoJson(
    data=cousub_gdf,
    name='Barrios',
    style_function=lambda x: {
        'fillColor': '#ff7f00',
        'color': '#b35900',
        'weight': 2,
        'fillOpacity': 0.2,
        'dashArray': '1, 5'  # Dotted line
    },
    highlight_function=cousub_highlight,
    tooltip=cousub_tooltip
).add_to(m)

# Add Subbarrios layer with solid lines
subbarrio_layer = folium.GeoJson(
    data=subbarrio_gdf,
    name='Subbarrios',
    style_function=lambda x: {
        'fillColor': '#3186cc',
        'color': '#004d99',
        'weight': 1.5,
        'fillOpacity': 0.3
    },
    highlight_function=subbarrio_highlight,
    tooltip=subbarrio_tooltip
).add_to(m)

# Add search function
Search(
    layer=subbarrio_layer,
    geom_type='Polygon',
    placeholder='Search for a Subbarrio',
    search_label='NAMELSAD',
    search_zoom=12,
    position='topleft'
).add_to(m)

# Create marker cluster for property locations
marker_cluster = MarkerCluster(name='Property Locations').add_to(m)

# Add property locations to the map
for idx, row in geo_data.dropna(subset=['crim.latitude', 'crim.longitude']).iterrows():
    lat = row['crim.latitude']
    lon = row['crim.longitude']
    
    # Create popup content
    popup_content = f"""
    <b>Control:</b> {row['Número Control']}<br>
    <b>Catastro:</b> {row['Catastro']}<br>
    <b>Occupied:</b> {row['Invadida']}<br>
    <b>Inspection Expired:</b> {row['Inspección Vencida']}<br>
    <b>Aging Bucket:</b> {row['Aging Bucket']}
    """
    
    # Add marker
    folium.Marker(
        location=[lat, lon],
        popup=folium.Popup(popup_content, max_width=300),
        tooltip=f"Property: {row['Número Control']}",
        icon=folium.Icon(icon='home', prefix='fa', color='blue')
    ).add_to(marker_cluster)

# Create legend
def create_legend():
    legend_img = Image.new('RGBA', (200, 230), (255, 255, 255, 230))
    draw = ImageDraw.Draw(legend_img)
    
    entries = [
        {'color': (215, 48, 39), 'dash': (5, 5), 'label': 'County (Municipio)'},
        {'color': (255, 127, 0), 'dash': (1, 5), 'label': 'Barrio'},
        {'color': (49, 134, 204), 'dash': None, 'label': 'Subbarrio'},
        {'color': (0, 0, 255), 'dash': None, 'label': 'Property', 'marker': True}
    ]
    
    draw.text((10, 10), "Map Features", fill=(0, 0, 0))
    
    for i, entry in enumerate(entries):
        y = 40 + i * 40
        
        if entry.get('marker', False):
            # Draw marker icon for property points
            draw.rectangle([(15, y + 5), (25, y + 15)], fill=entry['color'], outline=(0, 0, 0))
            draw.text((110, y + 5), entry['label'], fill=(0, 0, 0))
        else:
            draw.rectangle([(10, y), (30, y + 20)], fill=entry['color'] + (200,), outline=(0, 0, 0))
            
            if entry['dash']:
                dash_length, gap_length = entry['dash']
                x = 45
                while x < 100:
                    draw.line([(x, y + 10), (x + dash_length, y + 10)], fill=entry['color'], width=3)
                    x += dash_length + gap_length
            else:
                draw.line([(45, y + 10), (100, y + 10)], fill=entry['color'], width=3)
            
            draw.text((110, y + 5), entry['label'], fill=(0, 0, 0))
    
    buffered = BytesIO()
    legend_img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

# Add legend to map
legend_html = f'''
    <div style="position: fixed; bottom: 50px; left: 50px; border-radius: 5px; 
                box-shadow: 0 0 10px rgba(0,0,0,0.4); z-index: 9999;">
        <img src="data:image/png;base64,{create_legend()}" alt="Legend">
    </div>
'''
m.get_root().html.add_child(folium.Element(legend_html))

# Add info box
info_html = '''
<div class="info" style="position: fixed; top: 10px; right: 10px; z-index: 9998; 
                         background-color: white; padding: 10px; border-radius: 5px;
                         box-shadow: 0 0 10px rgba(0,0,0,0.4);">
    <h4>Puerto Rico Property Map</h4>
    <p>- Toggle layers to compare boundaries</p>
    <p>- Click features to highlight boundaries</p>
    <p>- Click markers to view property details</p>
    <p>- Different line styles indicate levels:</p>
    <p>&nbsp;&nbsp;• Dashed: Counties</p>
    <p>&nbsp;&nbsp;• Dotted: Barrios</p>
    <p>&nbsp;&nbsp;• Solid: Subbarrios</p>
    <p>&nbsp;&nbsp;• Blue markers: Properties</p>
    <button onclick="this.parentElement.style.display='none';">Close</button>
</div>
'''
m.get_root().html.add_child(folium.Element(info_html))

# Add layer control
folium.LayerControl(collapsed=False).add_to(m)

# Save map
m.save('puerto_rico_properties_map.html')

# Return map
m