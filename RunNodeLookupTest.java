public class RunNodeLookupTest {
  public static void main(String[] args) throws Exception {
    ProcessBuilder pb = new ProcessBuilder("node", "-v");
    pb.inheritIO();
    Process p = pb.start();
    System.exit(p.waitFor());
  }
}
