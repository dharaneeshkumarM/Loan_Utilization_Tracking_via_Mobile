import { useMemo, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '@/lib/theme';

export type MapMarker = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  status?: 'pending' | 'approved' | 'rejected';
  photoUrl?: string;
};

type MapViewProps = {
  markers: MapMarker[];
  onMarkerPress?: (id: string) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  initialZoom?: number;
};

const statusColor = (status?: string) => {
  switch (status) {
    case 'approved':
      return '#16a34a';
    case 'rejected':
      return '#dc2626';
    default:
      return '#f59e0b';
  }
};

export function MapView({
  markers,
  onMarkerPress,
  initialLatitude = 20,
  initialLongitude = 0,
  initialZoom = 2,
}: MapViewProps) {
  const webviewRef = useRef<WebView>(null);

  const html = useMemo(() => {
    const markersJson = JSON.stringify(
      markers.map((m) => ({
        id: m.id,
        lat: m.latitude,
        lng: m.longitude,
        title: m.title,
        subtitle: m.subtitle ?? '',
        color: statusColor(m.status),
        photo: m.photoUrl ?? '',
      })),
    );

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #e2e8f0; }
    #map { height: 100%; width: 100%; }
    .marker-pin {
      width: 24px; height: 24px; border-radius: 50% 50% 50% 0;
      background: var(--c); transform: rotate(-45deg);
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .marker-pin::after {
      content: ''; position: absolute; width: 8px; height: 8px;
      border-radius: 50%; background: #fff;
      top: 7px; left: 7px;
    }
    .leaflet-popup-content-wrapper { border-radius: 12px; }
    .leaflet-popup-content { margin: 12px 14px; font-family: -apple-system, sans-serif; }
    .popup-title { font-weight: 600; font-size: 14px; color: #0f172a; margin-bottom: 2px; }
    .popup-sub { font-size: 12px; color: #64748b; }
    .popup-img { width: 160px; height: 100px; object-fit: cover; border-radius: 8px; margin-top: 8px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var map = L.map('map', { zoomControl: true, attributionControl: false })
        .setView([${initialLatitude}, ${initialLongitude}], ${initialZoom});

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      var markers = ${markersJson};
      var markerLayer = {};

      markers.forEach(function(m) {
        var icon = L.divIcon({
          className: '',
          html: '<div class="marker-pin" style="--c:' + m.color + '"></div>',
          iconSize: [24, 30],
          iconAnchor: [12, 30],
          popupAnchor: [0, -28]
        });
        var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
        var popupHtml = '<div class="popup-title">' + escapeHtml(m.title) + '</div>' +
                        '<div class="popup-sub">' + escapeHtml(m.subtitle) + '</div>';
        if (m.photo) {
          popupHtml += '<img class="popup-img" src="' + m.photo + '" />';
        }
        marker.bindPopup(popupHtml);
        marker.on('click', function() {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'marker_click', id: m.id }));
        });
        markerLayer[m.id] = marker;
      });

      if (markers.length > 0) {
        var group = L.featureGroup(Object.values(markerLayer));
        map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 });
      }

      function escapeHtml(s) {
        if (!s) return '';
        return s.replace(/[&<>"']/g, function(c) {
          return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
        });
      }

      window.addEventListener('message', function(e) {
        try {
          var msg = JSON.parse(e.data);
          if (msg.type === 'focus' && markerLayer[msg.id]) {
            map.setView(markerLayer[msg.id].getLatLng(), Math.max(map.getZoom(), 15));
            markerLayer[msg.id].openPopup();
          }
        } catch (err) {}
      });
    })();
  </script>
</body>
</html>`;
  }, [markers, initialLatitude, initialLongitude, initialZoom]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'marker_click' && onMarkerPress) {
        onMarkerPress(data.id);
      }
    } catch {
      // ignore parse errors
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
          </View>
        )}
        startInLoadingState
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[200],
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[100],
  },
});
