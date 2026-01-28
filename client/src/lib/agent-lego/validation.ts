/**
 * Connection Validation
 *
 * Validates that connections between blocks are compatible.
 */

import type {
  WorkflowBlock,
  WorkflowConnection,
  BlockType,
  BlockPort,
  BLOCK_DEFINITIONS,
} from '@shared/types';
import { BLOCK_DEFINITIONS as DEFINITIONS } from '@shared/types';

// Data type compatibility matrix
// source type -> compatible target types
const TYPE_COMPATIBILITY: Record<string, string[]> = {
  'any': ['any', 'text', 'json', 'boolean', 'number', 'papers'],
  'text': ['any', 'text', 'json'],
  'json': ['any', 'json', 'text'],
  'boolean': ['any', 'boolean', 'text'],
  'number': ['any', 'number', 'text'],
  'papers': ['any', 'papers', 'json'],
};

/**
 * Check if two data types are compatible for connection
 */
export function areTypesCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  const compatible = TYPE_COMPATIBILITY[sourceType] || ['any'];
  return compatible.includes(targetType);
}

/**
 * Get block definition
 */
export function getBlockDefinition(type: BlockType) {
  return DEFINITIONS[type];
}

/**
 * Get output ports for a block type
 */
export function getOutputPorts(type: BlockType): BlockPort[] {
  const def = DEFINITIONS[type];
  return def?.outputs || [{ id: 'output', name: 'Output', type: 'output', dataType: 'any' }];
}

/**
 * Get input ports for a block type
 */
export function getInputPorts(type: BlockType): BlockPort[] {
  const def = DEFINITIONS[type];
  return def?.inputs || [{ id: 'input', name: 'Input', type: 'input', dataType: 'any' }];
}

/**
 * Validate a single connection
 */
export interface ConnectionValidation {
  valid: boolean;
  error?: string;
  warning?: string;
}

export function validateConnection(
  sourceBlock: WorkflowBlock,
  targetBlock: WorkflowBlock,
  sourcePort: string,
  targetPort: string
): ConnectionValidation {
  // Self-connection check
  if (sourceBlock.id === targetBlock.id) {
    return {
      valid: false,
      error: 'Cannot connect a block to itself',
    };
  }

  // Get port definitions
  const sourceOutputs = getOutputPorts(sourceBlock.type);
  const targetInputs = getInputPorts(targetBlock.type);

  const sourcePortDef = sourceOutputs.find(p => p.id === sourcePort);
  const targetPortDef = targetInputs.find(p => p.id === targetPort);

  // Port existence check
  if (!sourcePortDef) {
    return {
      valid: false,
      error: `Source port '${sourcePort}' not found on ${sourceBlock.type}`,
    };
  }

  if (!targetPortDef) {
    return {
      valid: false,
      error: `Target port '${targetPort}' not found on ${targetBlock.type}`,
    };
  }

  // Type compatibility check
  if (!areTypesCompatible(sourcePortDef.dataType, targetPortDef.dataType)) {
    return {
      valid: false,
      error: `Type mismatch: ${sourcePortDef.dataType} is not compatible with ${targetPortDef.dataType}`,
    };
  }

  // Type compatibility warning (implicit conversion)
  if (sourcePortDef.dataType !== targetPortDef.dataType &&
      sourcePortDef.dataType !== 'any' &&
      targetPortDef.dataType !== 'any') {
    return {
      valid: true,
      warning: `Data will be converted from ${sourcePortDef.dataType} to ${targetPortDef.dataType}`,
    };
  }

  return { valid: true };
}

/**
 * Validate all connections in a workflow
 */
export function validateAllConnections(
  blocks: WorkflowBlock[],
  connections: WorkflowConnection[]
): Array<{ connection: WorkflowConnection; validation: ConnectionValidation }> {
  const blockMap = new Map(blocks.map(b => [b.id, b]));
  const results: Array<{ connection: WorkflowConnection; validation: ConnectionValidation }> = [];

  for (const conn of connections) {
    const sourceBlock = blockMap.get(conn.sourceBlockId);
    const targetBlock = blockMap.get(conn.targetBlockId);

    if (!sourceBlock || !targetBlock) {
      results.push({
        connection: conn,
        validation: {
          valid: false,
          error: 'Connection references non-existent block',
        },
      });
      continue;
    }

    const validation = validateConnection(
      sourceBlock,
      targetBlock,
      conn.sourcePort,
      conn.targetPort
    );

    results.push({ connection: conn, validation });
  }

  return results;
}

/**
 * Check if a new connection would create a cycle
 */
export function wouldCreateCycle(
  blocks: WorkflowBlock[],
  connections: WorkflowConnection[],
  newSourceId: string,
  newTargetId: string
): boolean {
  // Build adjacency list including the new connection
  const adjacency = new Map<string, Set<string>>();

  for (const block of blocks) {
    adjacency.set(block.id, new Set());
  }

  for (const conn of connections) {
    adjacency.get(conn.sourceBlockId)?.add(conn.targetBlockId);
  }

  // Add the new connection
  adjacency.get(newSourceId)?.add(newTargetId);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId) || new Set();
    const neighborArray = Array.from(neighbors);
    for (let i = 0; i < neighborArray.length; i++) {
      const neighbor = neighborArray[i];
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const block of blocks) {
    if (!visited.has(block.id)) {
      if (hasCycle(block.id)) return true;
    }
  }

  return false;
}

/**
 * Get suggested connections for a block
 */
export function getSuggestedConnections(
  blocks: WorkflowBlock[],
  connections: WorkflowConnection[],
  blockId: string
): Array<{
  targetBlockId: string;
  sourcePort: string;
  targetPort: string;
  compatibility: 'perfect' | 'compatible' | 'convertible';
}> {
  const block = blocks.find(b => b.id === blockId);
  if (!block) return [];

  const suggestions: Array<{
    targetBlockId: string;
    sourcePort: string;
    targetPort: string;
    compatibility: 'perfect' | 'compatible' | 'convertible';
  }> = [];

  const outputs = getOutputPorts(block.type);

  for (const output of outputs) {
    for (const targetBlock of blocks) {
      if (targetBlock.id === blockId) continue;

      // Check if connection already exists
      const existingConnection = connections.find(
        c => c.sourceBlockId === blockId && c.targetBlockId === targetBlock.id
      );
      if (existingConnection) continue;

      // Check if would create cycle
      if (wouldCreateCycle(blocks, connections, blockId, targetBlock.id)) continue;

      const inputs = getInputPorts(targetBlock.type);
      for (const input of inputs) {
        // Already has incoming connection to this port
        const portHasConnection = connections.some(
          c => c.targetBlockId === targetBlock.id && c.targetPort === input.id
        );
        if (portHasConnection) continue;

        let compatibility: 'perfect' | 'compatible' | 'convertible' | null = null;

        if (output.dataType === input.dataType) {
          compatibility = 'perfect';
        } else if (output.dataType === 'any' || input.dataType === 'any') {
          compatibility = 'compatible';
        } else if (areTypesCompatible(output.dataType, input.dataType)) {
          compatibility = 'convertible';
        }

        if (compatibility) {
          suggestions.push({
            targetBlockId: targetBlock.id,
            sourcePort: output.id,
            targetPort: input.id,
            compatibility,
          });
        }
      }
    }
  }

  // Sort by compatibility (perfect first)
  suggestions.sort((a, b) => {
    const order = { perfect: 0, compatible: 1, convertible: 2 };
    return order[a.compatibility] - order[b.compatibility];
  });

  return suggestions;
}
