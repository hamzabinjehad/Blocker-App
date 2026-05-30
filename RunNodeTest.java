public class RunNodeTest {
  public static void main(String[] args) throws Exception {
    Process p = new ProcessBuilder("C:\\Users\\hamza\\Documents\\GitHub\\Blocker-App\\.codex-node\\codex-node.exe", "-v").inheritIO().start();
    System.exit(p.waitFor());
  }
}
