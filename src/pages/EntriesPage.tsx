import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SingleEntryForm from '@/components/entries/SingleEntryForm';
import BulkEntryGrid from '@/components/entries/BulkEntryGrid';
import EntryList from '@/components/entries/EntryList';
import { ExplainerTip } from '@/components/ExplainerTip';

export default function EntriesPage() {
  const { currentModule } = useAuth();
  const [tab, setTab] = useState('list');

  const defaultModule = currentModule === 'stitching' ? 'stitching' : currentModule === 'printing' ? 'printing' : undefined;

  return (
    <div>
      <h1 className="text-lg font-semibold mb-3 flex items-center gap-2">Production Entries <ExplainerTip text="Log daily production output by order, colourway, shift, and worker type. Labour costs are auto-calculated from rate masters. Use Bulk Entry for multi-row data entry." /></h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list">Entry List</TabsTrigger>
          <TabsTrigger value="single">Single Entry</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Entry Grid</TabsTrigger>
        </TabsList>
        <TabsContent value="list"><EntryList /></TabsContent>
        <TabsContent value="single"><SingleEntryForm defaultModule={defaultModule} /></TabsContent>
        <TabsContent value="bulk"><BulkEntryGrid defaultModule={defaultModule} /></TabsContent>
      </Tabs>
    </div>
  );
}
