// src/app/api/s3-delete/route.ts
import { NextResponse } from 'next/server';
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Initialize the S3 client (same as your upload route)
const s3Client = new S3Client({
    region: process.env.S3_BUCKET_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_KEY_!,
    },
});

export async function POST(request: Request) {
    try {
        const { fileKey } = await request.json();

        if (!fileKey) {
            return NextResponse.json({ error: "Missing fileKey" }, { status: 400 });
        }
        
        const bucketName = process.env.S3_BUCKET_NAME!;

        // Create the command to delete an object
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
        });

        // Send the command
        await s3Client.send(command);

        return NextResponse.json({ success: true, message: `Deleted ${fileKey}` });

    } catch (error) {
        console.error("Error deleting S3 object: ", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}