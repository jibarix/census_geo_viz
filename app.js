// Global variables
let map, propertyData, clusteredData;
let subbarrioLayer, barrioLayer, countyLayer, markerLayer;
let subbarrioData, barrioData, countyData;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize file upload listener
    document.getElementById('csv-upload').addEventListener('change', handleFileUpload);
    
    // Initialize button listeners
    document.getElementById('generate-map').addEventListener('click', generateMap);
    document.getElementById('generate-clusters').addEventListener('click', generateClusters);
    document.getElementById('download-clusters-md').addEventListener('click', downloadClustersMD);
    document.getElementById('download-classifications-csv').addEventListener('click', downloadClassificationsCSV);
    document.getElementById('download-map-html').addEventListener('click', downloadMapHTML);
    
    // Initialize map (hidden until generated)
    initMap();
    
    // Load GIS boundary data
    loadBoundaryData();
});

// Handle CSV file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusElement = document.getElementById('file-status');
    statusElement.textContent = "Reading file...";
    
    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        encoding: "UTF-8",
        complete: function(results) {
            if (results.errors.length > 0) {
                statusElement.textContent = "Error parsing CSV: " + results.errors[0].message;
                return;
            }
            
            propertyData = results.data;
            
            // Check if file has required columns
            const hasLatitude = propertyData.some(row => 
                row.hasOwnProperty('crim.latitude') && row['crim.latitude'] !== null);
            const hasLongitude = propertyData.some(row => 
                row.hasOwnProperty('crim.longitude') && row['crim.longitude'] !== null);
                
            if (!hasLatitude || !hasLongitude) {
                statusElement.textContent = "CSV must contain 'crim.latitude' and 'crim.longitude' columns";
                return;
            }
            
            statusElement.textContent = `Loaded ${propertyData.length} properties`;
            document.getElementById('generate-map').disabled = false;
        },
        error: function(error) {
            statusElement.textContent = "Error reading file: " + error;
        }
    });
}

// Initialize the map
function initMap() {
    map = L.map('map').setView([18.2208, -66.5901], 9);
    
    // Add base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Hide map initially
    document.getElementById('map-container').style.display = 'none';
}

// Load boundary data (GeoJSON)
function loadBoundaryData() {
    // In a real implementation, you'd fetch these from a server or include them as static files
    // For this example, we'll use placeholder code that would need to be replaced with actual data loading
    
    // Simulated loading of boundary data
    fetch('data/subbarrios.geojson')
        .then(response => response.json())
        .then(data => {
            subbarrioData = data;
            console.log("Loaded subbarrio data");
        })
        .catch(error => {
            console.error("Error loading subbarrio data:", error);
        });
        
    fetch('data/barrios.geojson')
        .then(response => response.json())
        .then(data => {
            barrioData = data;
            console.log("Loaded barrio data");
        })
        .catch(error => {
            console.error("Error loading barrio data:", error);
        });
        
    fetch('data/counties.geojson')
        .then(response => response.json())
        .then(data => {
            countyData = data;
            console.log("Loaded county data");
        })
        .catch(error => {
            console.error("Error loading county data:", error);
        });
}

// Generate the map with property data
function generateMap() {
    const loadingElement = document.getElementById('map-loading');
    loadingElement.style.display = 'inline';
    
    setTimeout(() => {
        try {
            // Display the map container
            document.getElementById('map-container').style.display = 'block';
            
            // Add boundary layers
            addBoundaryLayers();
            
            // Add property markers
            addPropertyMarkers();
            
            // Fit map to property bounds
            fitMapToBounds();
            
            // Enable cluster generation
            document.getElementById('generate-clusters').disabled = false;
            loadingElement.style.display = 'none';
        } catch (error) {
            loadingElement.textContent = "Error generating map: " + error;
        }
    }, 100); // Small timeout to allow UI to update
}

// Add administrative boundary layers to the map
function addBoundaryLayers() {
    // Add county layer
    if (countyLayer) map.removeLayer(countyLayer);
    countyLayer = L.geoJSON(countyData, {
        style: {
            color: '#800000',
            weight: 3,
            fillOpacity: 0.2,
            dashArray: '5, 5'
        },
        onEachFeature: function(feature, layer) {
            layer.bindTooltip(feature.properties.NAME);
        }
    }).addTo(map);
    
    // Add barrio layer
    if (barrioLayer) map.removeLayer(barrioLayer);
    barrioLayer = L.geoJSON(barrioData, {
        style: {
            color: '#b35900',
            weight: 2,
            fillOpacity: 0.2,
            dashArray: '1, 5'
        },
        onEachFeature: function(feature, layer) {
            layer.bindTooltip(feature.properties.NAMELSAD);
        }
    }).addTo(map);
    
    // Add subbarrio layer
    if (subbarrioLayer) map.removeLayer(subbarrioLayer);
    subbarrioLayer = L.geoJSON(subbarrioData, {
        style: {
            color: '#004d99',
            weight: 1.5,
            fillOpacity: 0.3
        },
        onEachFeature: function(feature, layer) {
            layer.bindTooltip(feature.properties.NAMELSAD);
        }
    }).addTo(map);
}

// Add property markers to the map
function addPropertyMarkers() {
    if (markerLayer) map.removeLayer(markerLayer);
    
    markerLayer = L.layerGroup().addTo(map);
    
    // Add markers for properties with valid coordinates
    propertyData.forEach(property => {
        if (property['crim.latitude'] && property['crim.longitude']) {
            const marker = L.marker([property['crim.latitude'], property['crim.longitude']])
                .bindPopup(createPopupContent(property))
                .addTo(markerLayer);
        }
    });
}

// Create popup content for property markers
function createPopupContent(property) {
    return `
        <b>Control:</b> ${property['Número Control'] || 'N/A'}<br>
        <b>Catastro:</b> ${property['Catastro'] || 'N/A'}<br>
        <b>Occupied:</b> ${property['Invadida'] || 'N/A'}<br>
        <b>Inspection Expired:</b> ${property['Inspección Vencida'] || 'N/A'}<br>
        <b>Aging Bucket:</b> ${property['Aging Bucket'] || 'N/A'}
    `;
}

// Fit map to the bounds of property markers
function fitMapToBounds() {
    const validProperties = propertyData.filter(p => 
        p['crim.latitude'] && p['crim.longitude']);
        
    if (validProperties.length > 0) {
        const latLngs = validProperties.map(p => 
            [p['crim.latitude'], p['crim.longitude']]);
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds);
    }
}

// Generate clusters analysis
function generateClusters() {
    const loadingElement = document.getElementById('cluster-loading');
    loadingElement.style.display = 'inline';
    
    setTimeout(() => {
        try {
            // Perform spatial join to assign properties to regions
            clusteredData = performSpatialJoin();
            
            // Show download section
            document.getElementById('download-section').style.display = 'block';
            loadingElement.style.display = 'none';
        } catch (error) {
            loadingElement.textContent = "Error generating clusters: " + error;
        }
    }, 100); // Small timeout to allow UI to update
}

// Perform spatial join to assign properties to administrative regions
function performSpatialJoin() {
    // In a full implementation, this would use turf.js to perform 
    // point-in-polygon analysis similar to your Python code
    
    // For this example, we'll create a simplified implementation
    const result = [];
    
    propertyData.forEach(property => {
        if (!property['crim.latitude'] || !property['crim.longitude']) return;
        
        const point = turf.point([property['crim.longitude'], property['crim.latitude']]);
        let inSubbarrio = false, inBarrio = false, inCounty = false;
        let subbarrioName = null, barrioName = null, countyName = null;
        
        // Check if point is in subbarrio
        for (const feature of subbarrioData.features) {
            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                inSubbarrio = true;
                subbarrioName = feature.properties.NAMELSAD;
                break;
            }
        }
        
        // Check if point is in barrio
        for (const feature of barrioData.features) {
            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                inBarrio = true;
                barrioName = feature.properties.NAMELSAD;
                break;
            }
        }
        
        // Check if point is in county
        for (const feature of countyData.features) {
            if (turf.booleanPointInPolygon(point, feature.geometry)) {
                inCounty = true;
                countyName = feature.properties.NAME;
                break;
            }
        }
        
        // Apply clustering logic similar to your Python code
        result.push({
            ...property,
            initial_subbarrio: subbarrioName,
            initial_barrio: barrioName,
            initial_county: countyName,
            // These fields would be populated after applying the clustering rules
            final_level: determineLevel(inSubbarrio, inBarrio, inCounty),
            final_area: determineFinalArea(subbarrioName, barrioName, countyName, 
                                           inSubbarrio, inBarrio, inCounty)
        });
    });
    
    // Apply the clustering rules to determine final assignments
    return applyClusteringRules(result);
}

// Determine the level of a property based on its location
function determineLevel(inSubbarrio, inBarrio, inCounty) {
    if (inSubbarrio) return 'subbarrio';
    if (inBarrio) return 'barrio';
    if (inCounty) return 'county';
    return 'unassigned';
}

// Determine the final area name for a property
function determineFinalArea(subbarrioName, barrioName, countyName, inSubbarrio, inBarrio, inCounty) {
    if (inSubbarrio) return subbarrioName;
    if (inBarrio) return barrioName;
    if (inCounty) return countyName;
    return null;
}

// Apply clustering rules to properties
function applyClusteringRules(properties) {
    // Count properties in each region
    const subbarrioCounts = {};
    const barrioCounts = {};
    
    properties.forEach(prop => {
        if (prop.initial_subbarrio) {
            subbarrioCounts[prop.initial_subbarrio] = 
                (subbarrioCounts[prop.initial_subbarrio] || 0) + 1;
        }
        
        if (prop.initial_barrio) {
            barrioCounts[prop.initial_barrio] = 
                (barrioCounts[prop.initial_barrio] || 0) + 1;
        }
    });
    
    // Get valid regions (those with at least 2 properties)
    const validSubbarrios = Object.keys(subbarrioCounts)
        .filter(name => subbarrioCounts[name] >= 2);
    
    const validBarrios = Object.keys(barrioCounts)
        .filter(name => barrioCounts[name] >= 2);
    
    // Apply final assignments based on clustering rules
    return properties.map(prop => {
        let finalLevel = 'unassigned';
        let finalArea = null;
        
        // If in valid subbarrio, assign to subbarrio
        if (prop.initial_subbarrio && validSubbarrios.includes(prop.initial_subbarrio)) {
            finalLevel = 'subbarrio';
            finalArea = prop.initial_subbarrio;
        }
        // Else if in valid barrio, assign to barrio
        else if (prop.initial_barrio && validBarrios.includes(prop.initial_barrio)) {
            finalLevel = 'barrio';
            finalArea = prop.initial_barrio;
        }
        // Else if in county, assign to county
        else if (prop.initial_county) {
            finalLevel = 'county';
            finalArea = prop.initial_county;
        }
        
        // Create classification path
        let path = [];
        if (prop.initial_subbarrio) path.push(`Subbarrio: ${prop.initial_subbarrio}`);
        if (prop.initial_barrio) path.push(`Barrio: ${prop.initial_barrio}`);
        if (prop.initial_county) path.push(`County: ${prop.initial_county}`);
        
        const classificationPath = path.join(' > ');
        
        return {
            ...prop,
            final_level: finalLevel,
            final_area: finalArea,
            classification_path: classificationPath
        };
    });
}

// Generate clusters report in Markdown format
function generateClustersMD() {
    let report = [];
    report.push("# Properties Clustered by Geographic Boundaries\n");
    report.push("(Minimum 2 properties per subbarrio/barrio, otherwise moved to higher level)\n\n");
    
    // Group properties by final assignment
    const byLevel = {
        subbarrio: {},
        barrio: {},
        county: {},
        unassigned: []
    };
    
    clusteredData.forEach(prop => {
        if (prop.final_level === 'unassigned') {
            byLevel.unassigned.push(prop);
        } else {
            if (!byLevel[prop.final_level][prop.final_area]) {
                byLevel[prop.final_level][prop.final_area] = [];
            }
            byLevel[prop.final_level][prop.final_area].push(prop);
        }
    });
    
    // Generate report sections
    report.push("## Properties in Subbarrios\n");
    for (const [subbarrio, properties] of Object.entries(byLevel.subbarrio)) {
        report.push(`### ${subbarrio} (${properties.length} properties)\n`);
        properties.forEach(prop => {
            report.push(`- ${prop['Número Control'] || 'N/A'} | ${prop.classification_path}\n`);
            report.push(`  Address: ${prop['Dirección Física'] || 'No address'}\n`);
        });
    }
    
    report.push("## Properties in Barrios (not in any Subbarrio or in Subbarrios with <2 properties)\n");
    for (const [barrio, properties] of Object.entries(byLevel.barrio)) {
        report.push(`### ${barrio} (${properties.length} properties)\n`);
        properties.forEach(prop => {
            report.push(`- ${prop['Número Control'] || 'N/A'} | ${prop.classification_path}\n`);
            report.push(`  Address: ${prop['Dirección Física'] || 'No address'}\n`);
        });
    }
    
    report.push("## Properties in Counties (not in any valid Barrio or Subbarrio)\n");
    for (const [county, properties] of Object.entries(byLevel.county)) {
        report.push(`### ${county} (${properties.length} properties)\n`);
        properties.forEach(prop => {
            report.push(`- ${prop['Número Control'] || 'N/A'} | ${prop.classification_path}\n`);
            report.push(`  Address: ${prop['Dirección Física'] || 'No address'}\n`);
        });
    }
    
    if (byLevel.unassigned.length > 0) {
        report.push("## Unclassified Properties\n");
        byLevel.unassigned.forEach(prop => {
            report.push(`- ${prop['Número Control'] || 'N/A'} | ${prop.classification_path || 'No classification'}\n`);
            report.push(`  Address: ${prop['Dirección Física'] || 'No address'}\n`);
        });
    }
    
    return report.join('');
}

// Generate classifications CSV
function generateClassificationsCSV() {
    // Convert clustered data to CSV
    const headers = [
        'Número Control', 'Dirección Física', 'Catastro', 
        'initial_subbarrio', 'initial_barrio', 'initial_county', 
        'final_level', 'final_area', 'classification_path', 
        'crim.latitude', 'crim.longitude'
    ];
    
    let csv = headers.join(',') + '\n';
    
    clusteredData.forEach(prop => {
        const row = headers.map(header => {
            let value = prop[header] || '';
            // Escape commas in string values
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        });
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Download the clusters report as MD file
function downloadClustersMD() {
    const content = generateClustersMD();
    downloadFile(content, 'property_clusters.md', 'text/markdown');
}

// Download the classifications as CSV file
function downloadClassificationsCSV() {
    const content = generateClassificationsCSV();
    downloadFile(content, 'property_classifications.csv', 'text/csv');
}

// Download the map as HTML file
function downloadMapHTML() {
    // Create a standalone HTML file with the map
    const html = generateMapHTML();
    downloadFile(html, 'puerto_rico_properties_map.html', 'text/html');
}

// Helper function to download a file
function downloadFile(content, filename, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

// Generate standalone HTML for the map
function generateMapHTML() {
    // This would generate a standalone HTML file with the map
    // For a complete implementation, you'd need to include all the necessary
    // CSS, JS, and the current map state
    
    // Simplified example
    return `<!DOCTYPE html>
<html>
<head>
    <title>Puerto Rico Property Map</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
    <style>
        body { margin: 0; padding: 0; }
        #map { width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
    <script>
        // Map initialization code would go here
        // This would be dynamically generated based on the current map state
    </script>
</body>
</html>`;
}