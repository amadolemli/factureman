import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

/**
 * Diagnostic component to test Supabase Storage configuration
 * This helps identify why signature uploads are failing
 */
export const StorageDiagnostic: React.FC = () => {
    const [results, setResults] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const addResult = (message: string, isError = false) => {
        const prefix = isError ? '❌' : '✅';
        setResults(prev => [...prev, `${prefix} ${message}`]);
        console.log(`${prefix} ${message}`);
    };

    const runDiagnostics = async () => {
        setResults([]);
        setIsRunning(true);
        addResult('Starting diagnostics...');

        try {
            // Test 1: Check authentication
            addResult('Test 1: Checking authentication...');
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError) {
                addResult(`Auth error: ${authError.message}`, true);
                setIsRunning(false);
                return;
            }

            if (!user) {
                addResult('User not authenticated', true);
                setIsRunning(false);
                return;
            }

            addResult(`User authenticated: ${user.id}`);
            addResult(`User email: ${user.email || 'N/A'}`);

            // Test 2: Check bucket existence
            addResult('Test 2: Checking user-assets bucket...');
            const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

            if (bucketsError) {
                addResult(`Error listing buckets: ${bucketsError.message}`, true);
            } else {
                const userAssetsBucket = buckets?.find(b => b.id === 'user-assets');
                if (userAssetsBucket) {
                    addResult(`Bucket 'user-assets' exists`);
                    addResult(`Bucket is ${userAssetsBucket.public ? 'PUBLIC' : 'PRIVATE'}`);
                } else {
                    addResult(`Bucket 'user-assets' NOT FOUND`, true);
                }
            }

            // Test 3: Try to create a test signature
            addResult('Test 3: Creating test signature...');
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 160;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 320, 160);
                ctx.fillStyle = 'black';
                ctx.font = '20px Arial';
                ctx.fillText('Test Signature', 50, 80);
            }
            const testDataUrl = canvas.toDataURL('image/png');
            addResult(`Test signature created (${testDataUrl.length} bytes)`);

            // Test 4: Convert to blob
            addResult('Test 4: Converting to blob...');
            const response = await fetch(testDataUrl);
            const blob = await response.blob();
            addResult(`Blob created: ${blob.size} bytes, type: ${blob.type}`);

            // Test 5: Try to upload
            addResult('Test 5: Attempting upload to Supabase...');
            const timestamp = Date.now();
            const fileName = `signatures/test_signature_${timestamp}.png`;
            const filePath = `${user.id}/${fileName}`;
            addResult(`Upload path: ${filePath}`);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('user-assets')
                .upload(filePath, blob, {
                    contentType: 'image/png',
                    upsert: true,
                    cacheControl: '3600'
                });

            if (uploadError) {
                addResult(`Upload failed: ${uploadError.message}`, true);
                addResult(`Error details: ${JSON.stringify(uploadError)}`, true);

                // Provide specific guidance based on error
                if (uploadError.message.includes('not found')) {
                    addResult('SOLUTION: Run FIX_SIGNATURE_UPLOAD_COMPLETE.sql in Supabase SQL Editor', true);
                } else if (uploadError.message.includes('policy')) {
                    addResult('SOLUTION: Storage policies are not configured correctly', true);
                    addResult('Run FIX_SIGNATURE_UPLOAD_COMPLETE.sql in Supabase SQL Editor', true);
                } else if (uploadError.message.includes('permission')) {
                    addResult('SOLUTION: User does not have permission to upload', true);
                    addResult('Check RLS policies on storage.objects table', true);
                }
            } else {
                addResult('Upload successful!');
                addResult(`Upload data: ${JSON.stringify(uploadData)}`);

                // Test 6: Get public URL
                addResult('Test 6: Getting public URL...');
                const { data: urlData } = supabase.storage
                    .from('user-assets')
                    .getPublicUrl(filePath);

                addResult(`Public URL: ${urlData.publicUrl}`);

                // Test 7: Clean up test file
                addResult('Test 7: Cleaning up test file...');
                const { error: deleteError } = await supabase.storage
                    .from('user-assets')
                    .remove([filePath]);

                if (deleteError) {
                    addResult(`Cleanup failed: ${deleteError.message}`, true);
                } else {
                    addResult('Test file deleted successfully');
                }
            }

            addResult('Diagnostics complete!');
        } catch (error) {
            addResult(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`, true);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-black mb-4 text-gray-900">Storage Diagnostic Tool</h2>
                <p className="text-sm text-gray-600 mb-6">
                    This tool will test your Supabase Storage configuration and help identify why signature uploads are failing.
                </p>

                <button
                    onClick={runDiagnostics}
                    disabled={isRunning}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed mb-6"
                >
                    {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
                </button>

                {results.length > 0 && (
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs space-y-1 max-h-96 overflow-y-auto">
                        {results.map((result, index) => (
                            <div
                                key={index}
                                className={result.startsWith('❌') ? 'text-red-400' : 'text-green-400'}
                            >
                                {result}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <h3 className="font-bold text-sm text-blue-900 mb-2">Next Steps:</h3>
                    <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Click "Run Diagnostics" to test your configuration</li>
                        <li>Review the results in the console above</li>
                        <li>If errors are found, follow the suggested solutions</li>
                        <li>Run FIX_SIGNATURE_UPLOAD_COMPLETE.sql in your Supabase SQL Editor if needed</li>
                        <li>Re-run diagnostics to verify the fix</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};
