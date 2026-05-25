import { Component, createContext } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { useTheme } from '@/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Could log to a remote service here
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback
          message={this.state.error?.message ?? 'An unexpected error occurred.'}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorBoundaryFallback({ message, onReset }: { message: string; onReset: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.bg.primary }]}>
      <Text style={[styles.title, { color: colors.text.primary }]} variant="headlineSmall">
        Something went wrong
      </Text>
      <Text style={[styles.message, { color: colors.text.secondary }]} variant="bodyMedium">
        {message}
      </Text>
      <Button mode="contained" onPress={onReset} style={styles.button}>
        Try again
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    fontWeight: '800',
  },
  message: {
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
  },
});
