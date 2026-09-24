'use client';

import {useEffect} from 'react';
import {z} from 'zod';
import {cards} from '@/packages/card-data/catalog';

type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: {readOnlyHint: boolean};
      execute: (input: unknown) => unknown;
    },
    options: {signal: AbortSignal},
  ) => void | Promise<void>;
};

export function useCatalogTools(
  onQuery: (query: string) => void,
  onColor: (color: string) => void,
  onType: (type: string) => void,
) {
  useEffect(() => {
    const context = (document as Document & {modelContext?: ModelContext}).modelContext;
    if (!context) return;

    const controller = new AbortController();
    const input = z.object({query: z.string().max(100)}).strict();
    const tool = {
      name: 'search_card_catalog',
      description: 'Search the visible card library by card name or number. This never changes saved data.',
      inputSchema: {
        type: 'object',
        properties: {query: {type: 'string', maxLength: 100}},
        required: ['query'],
        additionalProperties: false,
      },
      annotations: {readOnlyHint: true},
      execute(raw: unknown) {
        const {query} = input.parse(raw);
        onQuery(query);
        onColor('All colors');
        onType('All types');
        return {
          cards: cards
            .filter(card => `${card.name} ${card.code}`.toLowerCase().includes(query.toLowerCase()))
            .map(card => ({code: card.code, name: card.name, type: card.type})),
        };
      },
    };

    try {
      void Promise.resolve(context.registerTool(tool, {signal: controller.signal})).catch(() => {});
    } catch {}

    return () => controller.abort();
  }, [onColor, onQuery, onType]);
}
