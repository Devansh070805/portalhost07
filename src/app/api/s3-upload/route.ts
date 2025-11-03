import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// Initialize the S3 client
const s3Client = new S3Client({
    region: process.env.S3_REGION!, // <-- CHANGED
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!, // <-- CHANGED
        secretAccessKey: process.env.S3_SECRET_KEY!, // <-- CHANGED
    },
});

export async function POST(request: Request) {
    try {
        const { filename, filetype } = await request.json();

        if (!filename || !filetype) {
            return NextResponse.json({ error: "Missing filename or filetype" }, { status: 400 });
        }

        // Generate a unique file name to prevent overwrites
        const fileExtension = filename.split('.').pop();
        const uniqueKey = `${randomUUID()}.${fileExtension}`;
        
        const bucketName = process.env.S3_BUCKET_NAME!;

        // Create the command to put an object
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: uniqueKey,
            ContentType: filetype,
        });

        // Generate the presigned URL for upload
        const presignedUploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // Expires in 1 hour

        // Generate the final public URL
        const publicFileUrl = `https://${bucketName}.s3.${process.env.S3_REGION}.amazonaws.com/${uniqueKey}`; // <-- CHANGED

        return NextResponse.json({
            presignedUploadUrl,
            publicFileUrl,
        });

    } catch (error) {
        console.error("Error generating presigned URL: ", error);
        return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
    }
}