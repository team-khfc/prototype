import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;

/** Readiness probe using the JRE only; no curl or OS packages required. */
public final class HealthCheck {
    public static void main(String[] args) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) URI.create(args[0]).toURL().openConnection();
            connection.setConnectTimeout(1500);
            connection.setReadTimeout(1500);
            if (connection.getResponseCode() != 200) System.exit(1);
            try (var body = connection.getInputStream()) {
                String json = new String(body.readNBytes(4096), StandardCharsets.UTF_8);
                if (!json.matches("(?s).*\"status\"\\s*:\\s*\"UP\".*")) System.exit(1);
            }
        } catch (Exception exception) {
            System.err.println("API readiness check failed: " + exception.getClass().getSimpleName());
            System.exit(1);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
