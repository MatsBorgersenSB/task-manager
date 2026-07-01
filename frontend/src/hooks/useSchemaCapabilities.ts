"use client";

import { useEffect, useState } from "react";
import {
  getSchemaCapabilities,
  type SchemaCapabilities,
} from "@/lib/supabase/schemaCapabilities";

export function useSchemaCapabilities(): {
  capabilities: SchemaCapabilities | null;
  loading: boolean;
} {
  const [capabilities, setCapabilities] = useState<SchemaCapabilities | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getSchemaCapabilities()
      .then((next) => {
        if (active) setCapabilities(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { capabilities, loading };
}
